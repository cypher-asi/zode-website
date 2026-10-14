/**
 * Loads a dated policy snapshot (db/policy/YYYY-MM-DD/) into the policy
 * tracker tables in DATABASE_URL: statewide bills and orders, local pauses,
 * state grid gates and headline metrics.
 *
 *   npm run policy:import              newest snapshot
 *   npm run policy:import -- <dir>     a specific one
 *
 * Measures match on `key`, so a re-run updates rather than duplicates. Each
 * one keeps the date it was first and last seen; a history row is written
 * when a measure is new or its status or end date changed. Measures missing
 * from the snapshot are listed, never deleted, and a snapshot older than a
 * measure's last sighting doesn't overwrite it.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[policy:import] DATABASE_URL is not set; add it to .env.local.");
  process.exit(1);
}

const ROOT = new URL("../db/policy/", import.meta.url).pathname;
const TRACKER = "https://mjbommar.github.io/moratorium-data-2026/";

const STATE_NAMES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii",
  ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

const slug = (text) =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** `adopted` plus a term like "12mo", "180d" or "2y", as YYYY-MM-DD. */
function endsFrom(adopted, term) {
  if (!adopted || !term) return null;
  const match = /^(\d+)(d|mo|y)$/.exec(term);
  if (!match) throw new Error(`[policy:import] unreadable term "${term}"`);
  const n = Number(match[1]);
  const date = new Date(`${adopted}T00:00:00Z`);
  if (match[2] === "d") date.setUTCDate(date.getUTCDate() + n);
  if (match[2] === "mo") date.setUTCMonth(date.getUTCMonth() + n);
  if (match[2] === "y") date.setUTCFullYear(date.getUTCFullYear() + n);
  return date.toISOString().slice(0, 10);
}

function stateName(code) {
  const name = STATE_NAMES[code];
  if (!name) throw new Error(`[policy:import] unknown state "${code}"`);
  return name;
}

async function snapshotDir() {
  const arg = process.argv[2];
  if (arg) return path.resolve(arg);
  const dates = (await readdir(ROOT)).filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name)).sort();
  if (!dates.length) throw new Error(`[policy:import] no snapshots in ${ROOT}`);
  return path.join(ROOT, dates.at(-1));
}

const dir = await snapshotDir();
const observedOn = path.basename(dir);
if (!/^\d{4}-\d{2}-\d{2}$/.test(observedOn)) throw new Error(`[policy:import] ${dir} isn't named YYYY-MM-DD`);
const load = async (file) => JSON.parse(await readFile(path.join(dir, file), "utf8"));
const [stateRows, gridRows, localRows, metricRows] = await Promise.all(
  ["state.json", "grid.json", "local.json", "metrics.json"].map(load),
);

const measures = [
  ...stateRows.map((row) => ({
    key: `state:${row.state}:${row.kind}:${slug(row.instrument)}`,
    level: "state",
    kind: row.kind,
    state: row.state,
    jurisdiction: stateName(row.state),
    jurisdiction_type: "state",
    body: row.body ?? null,
    instrument: row.instrument ?? null,
    threshold_mw: row.mw ?? null,
    status: row.status,
    gate: null,
    adopted_on: row.adopted ?? null,
    ends_on: row.ends ?? null,
    note: row.note ?? null,
    source_url: row.url ?? null,
    confidence: row.conf ?? "medium",
  })),
  ...gridRows.map((row) => ({
    key: `grid:${row.state}:${slug(row.body)}`,
    level: "state",
    kind: "grid_gate",
    state: row.state,
    jurisdiction: stateName(row.state),
    jurisdiction_type: "state",
    body: row.body,
    instrument: row.instrument ?? null,
    threshold_mw: row.mw ?? null,
    status: row.status,
    gate: row.gate,
    adopted_on: row.adopted ?? null,
    ends_on: row.ends ?? null,
    note: row.note ?? null,
    source_url: row.url ?? null,
    confidence: row.conf ?? "medium",
  })),
  ...Object.entries(localRows).flatMap(([state, rows]) =>
    rows.map((row) => {
      stateName(state);
      return {
        key: `local:${state}:${slug(row.name)}`,
        level: "local",
        kind: "moratorium",
        state,
        jurisdiction: row.name,
        jurisdiction_type: row.type ?? "municipality",
        body: null,
        instrument: null,
        threshold_mw: row.mw ?? null,
        status: row.status ?? "in_effect",
        gate: null,
        adopted_on: row.adopted ?? null,
        ends_on: row.ends ?? endsFrom(row.adopted, row.term),
        note: row.note ?? null,
        source_url: row.url ?? TRACKER,
        confidence: row.conf ?? "medium",
      };
    }),
  ),
];

const keys = new Set();
for (const measure of measures) {
  if (keys.has(measure.key)) throw new Error(`[policy:import] duplicate key ${measure.key}`);
  keys.add(measure.key);
}

const sql = neon(url);
const existing = new Map(
  (await sql`select key, status, ends_on::text as ends_on, last_seen_on::text as last_seen_on from policy_measures`).map(
    (row) => [row.key, row],
  ),
);

const COLUMNS = [
  "key", "level", "kind", "state", "jurisdiction", "jurisdiction_type", "body", "instrument", "threshold_mw",
  "status", "gate", "adopted_on", "ends_on", "note", "source_url", "confidence",
];
const UPDATED = COLUMNS.filter((column) => column !== "key");

const counts = { added: 0, updated: 0, changed: 0, stale: 0 };
const queries = [];
for (const measure of measures) {
  const before = existing.get(measure.key);
  if (before && before.last_seen_on > observedOn) {
    counts.stale++;
    continue;
  }
  const values = COLUMNS.map((column) => measure[column]);
  const n = values.length;
  queries.push(
    sql.query(
      `insert into policy_measures (${COLUMNS.join(", ")}, first_seen_on, last_seen_on)
       values (${values.map((_, i) => `$${i + 1}`).join(", ")}, $${n + 1}, $${n + 1})
       on conflict (key) do update set
         ${UPDATED.map((column) => `${column} = excluded.${column}`).join(", ")},
         last_seen_on = excluded.last_seen_on, updated_at = now()`,
      [...values, observedOn],
    ),
  );
  const changed = !before || before.status !== measure.status || before.ends_on !== measure.ends_on;
  if (changed) {
    queries.push(
      sql.query(
        `insert into policy_measure_history (measure_id, observed_on, status, ends_on, note, source_url)
         select id, $2, $3, $4, $5, $6 from policy_measures where key = $1
         on conflict (measure_id, observed_on) do update set
           status = excluded.status, ends_on = excluded.ends_on, note = excluded.note,
           source_url = excluded.source_url, recorded_at = now()`,
        [measure.key, observedOn, measure.status, measure.ends_on, measure.note, measure.source_url],
      ),
    );
  }
  if (!before) counts.added++;
  else {
    counts.updated++;
    if (changed) counts.changed++;
  }
}

for (const metric of metricRows) {
  queries.push(
    sql.query(
      `insert into policy_metrics (observed_on, metric, value, unit, source_url) values ($1, $2, $3, $4, $5)
       on conflict (observed_on, metric) do update set
         value = excluded.value, unit = excluded.unit, source_url = excluded.source_url, recorded_at = now()`,
      [metric.on, metric.metric, metric.value, metric.unit ?? null, metric.url ?? null],
    ),
  );
}

const BATCH = 100;
for (let i = 0; i < queries.length; i += BATCH) {
  await sql.transaction(queries.slice(i, i + BATCH));
}

const missing = [...existing.keys()].filter((key) => !keys.has(key));
if (missing.length) console.warn(`[policy:import] in the database but not this snapshot:\n  ${missing.join("\n  ")}`);
if (counts.stale) console.warn(`[policy:import] skipped ${counts.stale} measures last seen after ${observedOn}`);

const local = await sql`
  select state, count(*)::int as n from policy_measures
  where level = 'local' and status = 'in_effect' and (ends_on is null or ends_on >= current_date)
  group by state order by state
`;
console.log(`[policy:import] local pauses in effect: ${local.map((row) => `${row.state} ${row.n}`).join(", ")}`);
console.log(
  `[policy:import] ${observedOn}: added ${counts.added} measures, updated ${counts.updated} (${counts.changed} changed), ` +
    `${metricRows.length} metrics, on ${new URL(url).hostname}`,
);
