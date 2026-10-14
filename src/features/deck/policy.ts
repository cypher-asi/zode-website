import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { DB_TAG, db } from "@/lib/db";
import type {
  GridGate,
  LocalPauses,
  PolicyMap,
  PolicyMeasure,
  PolicyState,
  StateAction,
  StateStatus,
} from "./policyTypes";

/** Every policy tracker read is cached under this tag. */
export const POLICY_TAG = "policy";

/** Statewide measures in the order they set a state's status: the first match wins. */
const RANK: readonly { status: StateStatus; kinds: readonly string[]; statuses: readonly string[] }[] = [
  { status: "statewide", kinds: ["moratorium"], statuses: ["in_effect"] },
  { status: "partial", kinds: ["land_pause", "incentive_pause"], statuses: ["in_effect"] },
  { status: "pending", kinds: ["moratorium"], statuses: ["pending"] },
  { status: "failed", kinds: ["moratorium"], statuses: ["failed", "vetoed"] },
];

const rankOf = (kind: string, status: string): number =>
  RANK.findIndex((rank) => rank.kinds.includes(kind) && rank.statuses.includes(status));

const KIND_LABELS: Readonly<Record<string, string>> = {
  moratorium: "Moratorium",
  land_pause: "State-land pause",
  incentive_pause: "Tax-break pause",
};

const dateOf = (iso: string, month: "long" | "short" = "long"): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month,
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

/** A local pause's place, with its kind of government where the name doesn't say it. */
function place(name: string, type: unknown): string {
  const kind = typeof type === "string" ? type.replace("_", "-") : "";
  return !kind || name.toLowerCase().includes(kind) ? name : `${name} (${kind})`;
}

/** Empty fields are left off rather than sent as undefined, which the client payload spells out per item. */
function measure(row: Record<string, unknown>, title: string): PolicyMeasure {
  const item: PolicyMeasure = { id: String(row.id), title };
  if (row.note) item.note = String(row.note);
  if (row.adopted) item.adopted = dateOf(String(row.adopted), "short");
  if (row.ends) item.ends = dateOf(String(row.ends), "short");
  if (row.url) item.url = String(row.url);
  return item;
}

const titleOf = (row: Record<string, unknown>): string =>
  [row.body, row.instrument].filter(Boolean).join(" · ");

type Draft = Omit<PolicyState, "actions"> & { actions: StateAction[] };

/**
 * The states slide's map: each state's strongest statewide action, how many
 * local pauses it has in effect and its grid gate, with the slide's two
 * headline figures. Every measure comes with its source, for the slide's
 * lists; the local pauses themselves are getLocalPauses'.
 */
export async function getPolicyMap(): Promise<PolicyMap> {
  "use cache";
  cacheLife("hours");
  cacheTag(POLICY_TAG, DB_TAG);
  const sql = db();
  const [measures, local, [lawmakers], [ercot], [seen]] = await sql.transaction([
    sql`
      select key as id, state, kind, status, gate, body, instrument, note,
        adopted_on::text as adopted, ends_on::text as ends, source_url as url
      from policy_measures
      where level = 'state' and (kind <> 'grid_gate' or status = 'in_effect')
      order by state, adopted_on nulls last
    `,
    sql`
      select state, count(*)::int as n from policy_measures
      where level = 'local' and status = 'in_effect' and (ends_on is null or ends_on >= current_date)
      group by state
    `,
    sql`
      select count(distinct state)::int as n from policy_measures
      where level = 'state' and kind = 'moratorium' and body = 'Legislature'
        and status in ('in_effect', 'pending', 'failed', 'vetoed')
    `,
    sql`
      select
        (select value::float8 from policy_metrics where metric = 'ercot_large_load_queue_gw'
          order by observed_on desc limit 1) as queue,
        (select value::float8 from policy_metrics where metric = 'ercot_record_peak_gw'
          order by observed_on desc limit 1) as peak
    `,
    sql`select max(last_seen_on)::text as as_of from policy_measures`,
  ]);

  const states: Record<string, Draft> = {};
  const ranked: Record<string, { rank: number; action: StateAction }[]> = {};
  const entry = (state: string) => (states[state] ??= { actions: [], localCount: 0 });

  for (const row of measures) {
    const state = String(row.state);
    if (row.kind === "grid_gate") {
      entry(state).grid = { ...measure(row, titleOf(row)), gate: row.gate as GridGate };
      continue;
    }
    const kind = String(row.kind);
    const status = String(row.status);
    const rank = rankOf(kind, status);
    const action: StateAction = {
      ...measure(row, titleOf(row)),
      label: `${KIND_LABELS[kind] ?? kind} ${status.replace("_", " ")}`,
    };
    if (rank >= 0) action.status = RANK[rank].status;
    (ranked[state] ??= []).push({ rank: rank < 0 ? RANK.length : rank, action });
  }
  for (const [state, actions] of Object.entries(ranked)) {
    actions.sort((a, b) => a.rank - b.rank);
    const { status } = actions[0].action;
    if (status) entry(state).status = status;
    entry(state).actions = actions.map(({ action }) => action);
  }
  for (const row of local) entry(String(row.state)).localCount = Number(row.n);

  return {
    asOf: seen?.as_of ? dateOf(String(seen.as_of)) : "",
    states,
    lawmakerStates: Number(lawmakers?.n ?? 0),
    ercotQueueGw: ercot?.queue == null ? null : Number(ercot.queue),
    ercotPeakGw: ercot?.peak == null ? null : Number(ercot.peak),
  };
}

/** Each state's local pauses in effect, by place, for the states slide's lists. */
export async function getLocalPauses(): Promise<LocalPauses> {
  "use cache";
  cacheLife("hours");
  cacheTag(POLICY_TAG, DB_TAG);
  const rows = await db()`
    select key as id, state, jurisdiction, jurisdiction_type as type, note,
      adopted_on::text as adopted, ends_on::text as ends, source_url as url
    from policy_measures
    where level = 'local' and status = 'in_effect' and (ends_on is null or ends_on >= current_date)
    order by state, jurisdiction
  `;
  const pauses: Record<string, PolicyMeasure[]> = {};
  for (const row of rows) (pauses[String(row.state)] ??= []).push(measure(row, place(String(row.jurisdiction), row.type)));
  return pauses;
}
