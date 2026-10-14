import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { DB_TAG, db } from "@/lib/db";
import type { GridGate, PolicyMap, PolicyState, StateStatus } from "./policyTypes";

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

const longDate = (iso: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * The states slide's map: each state's strongest statewide action, its local
 * pauses in effect and its grid gate, with the slide's two headline figures.
 */
export async function getPolicyMap(): Promise<PolicyMap> {
  "use cache";
  cacheLife("hours");
  cacheTag(POLICY_TAG, DB_TAG);
  const sql = db();
  const [measures, local, [lawmakers], [ercot], [seen]] = await sql.transaction([
    sql`
      select state, kind, status, gate, body, instrument, note
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

  const states: Record<string, PolicyState> = {};
  const ranked: Record<string, { rank: number; text: string }[]> = {};
  const entry = (state: string) => (states[state] ??= { actions: [], local: 0 });

  for (const row of measures) {
    const state = String(row.state);
    if (row.kind === "grid_gate") {
      entry(state).grid = { gate: row.gate as GridGate, note: `${row.body}: ${row.note}` };
      continue;
    }
    const rank = rankOf(String(row.kind), String(row.status));
    if (rank >= 0) (ranked[state] ??= []).push({ rank, text: `${row.instrument}: ${row.note}` });
  }
  for (const [state, actions] of Object.entries(ranked)) {
    actions.sort((a, b) => a.rank - b.rank);
    entry(state).status = RANK[actions[0].rank].status;
    entry(state).actions = actions.map((action) => action.text);
  }
  for (const row of local) entry(String(row.state)).local = Number(row.n);

  return {
    asOf: seen?.as_of ? longDate(String(seen.as_of)) : "",
    states,
    lawmakerStates: Number(lawmakers?.n ?? 0),
    ercotQueueGw: ercot?.queue == null ? null : Number(ercot.queue),
    ercotPeakGw: ercot?.peak == null ? null : Number(ercot.peak),
  };
}
