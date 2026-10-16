import "server-only";
import { DEAL_TYPES, SITE_TYPES } from "@/features/zrm/fields";
import { db } from "@/lib/db";

/** Capacity's statuses, furthest along first, each with the metric holding its sites' total IT. */
export const CAPACITY_STATUSES = [
  { status: "Closed", metric: "capacity_status_closed_mw" },
  { status: "Contracted", metric: "capacity_status_contracted_mw" },
  { status: "LOI", metric: "capacity_status_loi_mw" },
  { status: "Negotiation", metric: "capacity_status_negotiation_mw" },
  { status: "Prospect", metric: "capacity_status_prospect_mw" },
] as const;

/**
 * Every figure the team dashboard tracks, as stored in team_metric_snapshots.
 * Renaming one orphans its history, so add new names rather than reuse old ones.
 */
export const METRICS = [
  "capacity_contracted_mw",
  "capacity_pipeline_mw",
  ...CAPACITY_STATUSES.map((entry) => entry.metric),
  "opportunities_open",
  "opportunities_pipeline_usd",
  "contracts_total",
  "contracts_compute",
  "contracts_compute_mw",
  "subscribers_confirmed",
  "subscribers_news",
  "subscribers_changelog",
] as const;

export type MetricKey = (typeof METRICS)[number];

export type MetricValues = Record<MetricKey, number>;

export interface MetricPoint {
  /** The UTC day, `YYYY-MM-DD`. */
  day: string;
  value: number;
}

/** A share of the capacity pipeline, e.g. its leases. */
export interface MixSlice {
  label: string;
  mw: number;
}

export interface TeamMetrics {
  current: MetricValues;
  /** Each metric's daily values over the range, oldest first. Days without a snapshot are absent. */
  series: Record<MetricKey, MetricPoint[]>;
  rangeDays: number;
  /** The pipeline's MW now by deal type and by site type, in their fields' order, unset last. */
  capacityMix: { dealType: MixSlice[]; siteType: MixSlice[] };
}

/** Rows of `label, mw` as slices in `order`, with sites missing the field last as "Not set". */
function mixOf(rows: Record<string, unknown>[], order: readonly string[]): MixSlice[] {
  const mw = new Map(rows.map((row) => [String(row.label), Number(row.mw)]));
  return [...order, ""]
    .map((label) => ({ label: label || "Not set", mw: mw.get(label) ?? 0 }))
    .filter((slice) => slice.mw > 0);
}

/** The total IT of the sites on `statuses`, as a scalar subquery. */
const capacityOn = (...statuses: string[]): string => `
          (select coalesce(sum(s.total_it_mw), 0) from capacity_sites s
           join capacity_statuses st on st.id = s.status_id where st.name in (${statuses.map((name) => `'${name}'`).join(", ")}))`;

/**
 * Every metric computed now, as the CTE `m (metric, value)`. Capacity counts
 * Contracted and Closed sites as contracted and every site as pipeline; an
 * opportunity is open until it reaches the last pipeline stage.
 */
const CURRENT = `
    m (metric, value) as (
      values
        ('capacity_contracted_mw', ${capacityOn("Contracted", "Closed")}),
        ('capacity_pipeline_mw', (select coalesce(sum(total_it_mw), 0) from capacity_sites)),
        ${CAPACITY_STATUSES.map(({ status, metric }) => `('${metric}', ${capacityOn(status)}),`).join("\n        ")}
        ('opportunities_open',
          (select count(*) from zrm_opportunities o join zrm_stages g on g.id = o.stage_id
           where g.position < (select max(position) from zrm_stages))),
        ('opportunities_pipeline_usd',
          (select coalesce(sum(o.value), 0) from zrm_opportunities o join zrm_stages g on g.id = o.stage_id
           where g.position < (select max(position) from zrm_stages))),
        ('contracts_total', (select count(*) from mndas) + (select count(*) from compute_contracts)),
        ('contracts_compute', (select count(*) from compute_contracts)),
        ('contracts_compute_mw', (select coalesce(sum(it_mw), 0) from compute_contracts)),
        ('subscribers_confirmed', (select count(distinct email) from mailing_list_subscribers where status = 'subscribed')),
        ('subscribers_news', (select count(*) from mailing_list_subscribers where list = 'news' and status = 'subscribed')),
        ('subscribers_changelog',
          (select count(*) from mailing_list_subscribers where list = 'changelog' and status = 'subscribed'))
    )`;

function valuesOf(rows: Record<string, unknown>[]): MetricValues {
  const values = Object.fromEntries(METRICS.map((key) => [key, 0])) as MetricValues;
  for (const row of rows) {
    if ((METRICS as readonly string[]).includes(String(row.metric))) values[row.metric as MetricKey] = Number(row.value);
  }
  return values;
}

/** Computes every metric now and writes it as today's snapshot, replacing an earlier one from today. */
export async function recordTeamSnapshot(): Promise<MetricValues> {
  const rows = await db().query(`
    with ${CURRENT}
    insert into team_metric_snapshots (day, metric, value)
    select current_date, metric, value from m
    on conflict (day, metric) do update set value = excluded.value, taken_at = now()
    returning metric, value
  `);
  return valuesOf(rows);
}

/**
 * The dashboard's figures: every metric now and the last `rangeDays` days of
 * history, with today's point the live figures. Only reads; the cron in
 * vercel.json takes each day's snapshot.
 */
export async function loadTeamMetrics(rangeDays: number): Promise<TeamMetrics> {
  const sql = db();
  const [live, rows, byDealType, bySiteType] = await sql.transaction(
    [
      sql.query(`with ${CURRENT} select current_date::text as day, metric, value from m`),
      sql`
        select day::text as day, metric, value
        from team_metric_snapshots
        where day > current_date - ${rangeDays}::int
        order by day
      `,
      sql`select coalesce(deal_type, '') as label, sum(total_it_mw)::float8 as mw from capacity_sites group by 1`,
      sql`select coalesce(site_stage, '') as label, sum(total_it_mw)::float8 as mw from capacity_sites group by 1`,
    ],
    { readOnly: true },
  );
  const current = valuesOf(live);
  const today = String(live[0]?.day);
  const series = Object.fromEntries(METRICS.map((key) => [key, [] as MetricPoint[]])) as Record<MetricKey, MetricPoint[]>;
  for (const row of rows) {
    if (String(row.day) !== today) series[row.metric as MetricKey]?.push({ day: String(row.day), value: Number(row.value) });
  }
  for (const key of METRICS) series[key].push({ day: today, value: current[key] });
  return {
    current,
    series,
    rangeDays,
    capacityMix: { dealType: mixOf(byDealType, DEAL_TYPES), siteType: mixOf(bySiteType, SITE_TYPES) },
  };
}
