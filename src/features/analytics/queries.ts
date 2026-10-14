import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { DB_TAG, db } from "@/lib/db";
import { BOUNCE_ENGAGED_MS, REALTIME_MINUTES, TIME_ZONE } from "./definitions";
import { bucketFor, DIMENSIONS, lastDays, NONE, type Dimension, type Filters, type Period } from "./filters";
import { GOALS_TAG, listGoals, type Goal } from "./goals";

/**
 * The Analytics app's reports, straight from analytics_events. Every query
 * is parameterized; the only SQL spliced in is from the allowlists here
 * (columns, sorts), never from the URL.
 *
 * The reports are cached on the server by their filters for `minutes`, so
 * the viewer is checked by the page before calling them. `loadRealtime`
 * isn't cached, as its page refreshes every few seconds.
 */

export const PAGE_SIZE = 50;

class Query {
  readonly params: unknown[] = [];

  p(value: unknown): string {
    this.params.push(value);
    return `$${this.params.length}`;
  }

  async rows<T>(text: string): Promise<T[]> {
    return (await db().query(text, this.params)) as T[];
  }
}

const tz = (q: Query) => `${q.p(TIME_ZONE)}::text`;

function dimFilter(q: Query, dim: Dimension, value: string): string {
  const column = DIMENSIONS[dim].column;
  return value === NONE ? `${column} is null` : `${column} = ${q.p(value)}`;
}

/**
 * The rows a report reads: the period, the team toggle, the area and the
 * dimension filters. `pages: false` leaves out the page filters, for reports
 * that need a whole session to tell where it entered or went next.
 */
function scope(q: Query, filters: Filters, period: Period, { pages = true }: { pages?: boolean } = {}): string {
  const zone = tz(q);
  const parts = [
    `e.created_at >= (${q.p(period.start)}::date)::timestamp at time zone ${zone}`,
    `e.created_at < (${q.p(period.end)}::date + 1)::timestamp at time zone ${zone}`,
  ];
  if (!filters.team) parts.push("not e.is_team");
  if (filters.area) parts.push(`e.area = ${q.p(filters.area)}`);
  for (const [dim, value] of Object.entries(filters.dims) as [Dimension, string][]) {
    if (pages || !DIMENSIONS[dim].page) parts.push(dimFilter(q, dim, value));
  }
  return parts.join(" and ");
}

function pageFilters(q: Query, filters: Filters): string {
  const parts = (Object.entries(filters.dims) as [Dimension, string][])
    .filter(([dim]) => DIMENSIONS[dim].page)
    .map(([dim, value]) => dimFilter(q, dim, value));
  return parts.length ? parts.join(" and ") : "true";
}

const likePattern = (pattern: string) => pattern.replace(/[\\%_]/g, "\\$&").replace(/\*/g, "%");

function goalMatch(q: Query, goal: Goal): string {
  return goal.matchKind === "event"
    ? `(e.kind = 'event' and e.name = ${q.p(goal.match)})`
    : `(e.kind = 'pageview' and e.path like ${q.p(likePattern(goal.match))})`;
}

const anyGoal = (q: Query, goals: Goal[]) => (goals.length ? goals.map((goal) => goalMatch(q, goal)).join(" or ") : "false");

const BOUNCE = `(s.pageviews <= 1 and s.events = 0 and s.engaged_ms < ${BOUNCE_ENGAGED_MS})`;

/** The columns of `ev` that `s`, the goals and the series read. */
const EV_COLUMNS = ["e.session_id", "e.visitor_id", "e.created_at", "e.kind", "e.name", "e.path", "e.engaged_ms"];

/**
 * `ev`, the rows in scope, and `s`, one row per session that viewed a page:
 * its counts, engaged time, whether it converted and, with `key`, the
 * dimension it arrived with.
 */
function sessionsCte(q: Query, filters: Filters, period: Period, goals: Goal[], key?: string): string {
  const columns = key && !EV_COLUMNS.includes(key) ? [...EV_COLUMNS, key] : EV_COLUMNS;
  return `
    ev as (select ${columns.join(", ")} from analytics_events e where ${scope(q, filters, period)}),
    s as (
      select e.session_id, e.visitor_id,
        ${key ? `(array_agg(${key} order by e.created_at))[1] as key,` : ""}
        min(e.created_at) as started_at,
        count(*) filter (where e.kind = 'pageview') as pageviews,
        count(*) filter (where e.kind = 'event') as events,
        coalesce(sum(e.engaged_ms), 0) as engaged_ms,
        coalesce(bool_or(${anyGoal(q, goals)}), false) as converted
      from ev e
      group by e.session_id, e.visitor_id
      having count(*) filter (where e.kind = 'pageview') > 0
    )`;
}

export interface Kpis {
  visitors: number;
  sessions: number;
  pageviews: number;
  viewsPerSession: number;
  bounceRate: number;
  sessionDuration: number;
  conversions: number;
  conversionRate: number;
}

async function kpisFor(filters: Filters, period: Period, goals: Goal[]): Promise<Kpis> {
  const q = new Query();
  const [row] = await q.rows<Record<string, number | null>>(`
    with ${sessionsCte(q, filters, period, goals)}
    select
      count(distinct s.visitor_id)::int as visitors,
      count(*)::int as sessions,
      coalesce(sum(s.pageviews), 0)::int as pageviews,
      coalesce(avg(${BOUNCE}::int), 0)::float as bounce_rate,
      coalesce(avg(s.engaged_ms), 0)::float as session_duration,
      count(*) filter (where s.converted)::int as conversions
    from s
  `);
  const sessions = Number(row?.sessions ?? 0);
  const conversions = Number(row?.conversions ?? 0);
  return {
    visitors: Number(row?.visitors ?? 0),
    sessions,
    pageviews: Number(row?.pageviews ?? 0),
    viewsPerSession: sessions ? Number(row?.pageviews ?? 0) / sessions : 0,
    bounceRate: Number(row?.bounce_rate ?? 0),
    sessionDuration: Number(row?.session_duration ?? 0),
    conversions,
    conversionRate: sessions ? conversions / sessions : 0,
  };
}

/** The headline figures for the period and the one before it. */
export async function loadKpis(filters: Filters): Promise<{ current: Kpis; previous: Kpis }> {
  "use cache";
  cacheLife("minutes");
  cacheTag(GOALS_TAG, DB_TAG);
  const goals = await listGoals();
  const [current, previous] = await Promise.all([
    kpisFor(filters, filters.period, goals),
    kpisFor(filters, filters.previous, goals),
  ]);
  return { current, previous };
}

export interface SeriesPoint {
  /** The bucket's start in the reports' zone, `YYYY-MM-DDTHH:MM`. */
  bucket: string;
  /** Still to come today, so it has no figures yet. */
  future: boolean;
  visitors: number;
  sessions: number;
  pageviews: number;
  bounceRate: number | null;
  sessionDuration: number | null;
}

export type SeriesMetric = "visitors" | "sessions" | "pageviews" | "bounceRate" | "sessionDuration";

async function seriesFor(filters: Filters, period: Period): Promise<SeriesPoint[]> {
  const q = new Query();
  const unit = q.p(bucketFor(period));
  const zone = tz(q);
  const start = q.p(period.start);
  const end = q.p(period.end);
  const rows = await q.rows<Record<string, string | number | boolean | null>>(`
    with buckets as (
      select generate_series(
        date_trunc(${unit}, (${start}::date)::timestamp),
        date_trunc(${unit}, (${end}::date + 1)::timestamp - interval '1 second'),
        ('1 ' || ${unit})::interval
      ) as bucket
    ),
    ${sessionsCte(q, filters, period, [])},
    pv as (
      select date_trunc(${unit}, e.created_at at time zone ${zone}) as bucket,
        count(distinct e.visitor_id) filter (where e.kind = 'pageview') as visitors,
        count(*) filter (where e.kind = 'pageview') as pageviews
      from ev e group by 1
    ),
    ss as (
      select date_trunc(${unit}, s.started_at at time zone ${zone}) as bucket,
        count(*) as sessions,
        avg(${BOUNCE}::int)::float as bounce_rate,
        avg(s.engaged_ms)::float as session_duration
      from s group by 1
    )
    select to_char(b.bucket, 'YYYY-MM-DD"T"HH24:MI') as bucket,
      b.bucket > now() at time zone ${zone} as future,
      coalesce(pv.visitors, 0)::int as visitors,
      coalesce(pv.pageviews, 0)::int as pageviews,
      coalesce(ss.sessions, 0)::int as sessions,
      ss.bounce_rate, ss.session_duration
    from buckets b
    left join pv on pv.bucket = b.bucket
    left join ss on ss.bucket = b.bucket
    order by b.bucket
  `);
  return rows.map((row) => ({
    bucket: String(row.bucket),
    future: row.future === true,
    visitors: Number(row.visitors),
    sessions: Number(row.sessions),
    pageviews: Number(row.pageviews),
    bounceRate: row.bounce_rate === null ? null : Number(row.bounce_rate),
    sessionDuration: row.session_duration === null ? null : Number(row.session_duration),
  }));
}

/** The period's figures over time, and the previous period's for the comparison line. */
export async function loadTimeseries(filters: Filters): Promise<{ current: SeriesPoint[]; previous: SeriesPoint[] }> {
  "use cache";
  cacheLife("minutes");
  cacheTag(DB_TAG);
  const [current, previous] = await Promise.all([
    seriesFor(filters, filters.period),
    seriesFor(filters, filters.previous),
  ]);
  return { current, previous };
}

export interface PageRow {
  key: string;
  visitors: number;
  pageviews: number;
  engagedTime: number;
  scrollDepth: number;
  entries: number;
  exits: number;
  bounceRate: number | null;
}

export const PAGE_SORTS = {
  key: "key",
  visitors: "visitors",
  pageviews: "pageviews",
  engaged_time: "engaged_time",
  scroll_depth: "scroll_depth",
  entries: "entries",
  exits: "exits",
  bounce_rate: "bounce_rate",
} as const;

export type PageSort = keyof typeof PAGE_SORTS;

export interface Sorting<S extends string> {
  sort: S;
  dir: "asc" | "desc";
  page: number;
}

export interface Paged<T> {
  rows: T[];
  total: number;
}

/**
 * Pages by route or exact path: who saw them, for how long, how far down,
 * and how often sessions started, ended or bounced on them. Entries and exits
 * are worked out over whole sessions before the page filters apply.
 */
export async function loadPages(
  filters: Filters,
  group: "route" | "path",
  { sort, dir, page }: Sorting<PageSort>,
  period: Period = filters.period,
): Promise<Paged<PageRow>> {
  "use cache";
  cacheLife("minutes");
  cacheTag(DB_TAG);
  const q = new Query();
  const rows = await q.rows<Record<string, string | number | null>>(`
    with ev as (
      select e.session_id, e.visitor_id, e.created_at, e.kind, e.route, e.path, e.engaged_ms, e.scroll_pct
      from analytics_events e where ${scope(q, filters, period, { pages: false })}
    ),
    seq as (
      select e.*,
        count(*) filter (where e.kind = 'event') over w as session_events,
        count(*) filter (where e.kind = 'pageview') over w as session_pageviews,
        row_number() over (partition by e.session_id, e.kind order by e.created_at) as n_asc,
        row_number() over (partition by e.session_id, e.kind order by e.created_at desc) as n_desc
      from ev e
      window w as (partition by e.session_id)
    ),
    p as (
      select e.${group} as key,
        count(distinct e.visitor_id)::int as visitors,
        count(*)::int as pageviews,
        avg(e.engaged_ms)::float as engaged_time,
        avg(e.scroll_pct)::float as scroll_depth,
        count(*) filter (where e.n_asc = 1)::int as entries,
        count(*) filter (where e.n_desc = 1)::int as exits,
        count(*) filter (
          where e.n_asc = 1 and e.session_pageviews = 1 and e.session_events = 0 and e.engaged_ms < ${BOUNCE_ENGAGED_MS}
        )::int as bounces
      from seq e
      where e.kind = 'pageview' and ${pageFilters(q, filters)}
      group by 1
    )
    select p.*, case when p.entries > 0 then p.bounces::float / p.entries end as bounce_rate, count(*) over ()::int as total
    from p
    order by ${PAGE_SORTS[sort]} ${dir === "asc" ? "asc" : "desc"} nulls last, key
    limit ${PAGE_SIZE} offset ${q.p(page * PAGE_SIZE)}
  `);
  return {
    total: Number(rows[0]?.total ?? 0),
    rows: rows.map((row) => ({
      key: String(row.key),
      visitors: Number(row.visitors),
      pageviews: Number(row.pageviews),
      engagedTime: Number(row.engaged_time ?? 0),
      scrollDepth: Number(row.scroll_depth ?? 0),
      entries: Number(row.entries),
      exits: Number(row.exits),
      bounceRate: row.bounce_rate === null ? null : Number(row.bounce_rate),
    })),
  };
}

export interface BreakdownRow {
  key: string | null;
  visitors: number;
  sessions: number;
  pageviews: number;
  bounceRate: number;
  sessionDuration: number;
  conversions: number;
  conversionRate: number;
}

export const BREAKDOWN_SORTS = {
  key: "key",
  visitors: "visitors",
  sessions: "sessions",
  pageviews: "pageviews",
  bounce_rate: "bounce_rate",
  session_duration: "session_duration",
  conversions: "conversions",
  conversion_rate: "conversion_rate",
} as const;

export type BreakdownSort = keyof typeof BREAKDOWN_SORTS;

/**
 * Sessions grouped by what they arrived with (channel, referrer, campaign,
 * country, device and so on), with how they went and how many converted.
 */
export async function loadBreakdown(
  filters: Filters,
  dim: Exclude<Dimension, "route" | "path">,
  { sort, dir, page }: Sorting<BreakdownSort>,
  limit = PAGE_SIZE,
): Promise<Paged<BreakdownRow>> {
  "use cache";
  cacheLife("minutes");
  cacheTag(GOALS_TAG, DB_TAG);
  const goals = await listGoals();
  const q = new Query();
  const rows = await q.rows<Record<string, string | number | null>>(`
    with ${sessionsCte(q, filters, filters.period, goals, DIMENSIONS[dim].column)}
    select s.key,
      count(distinct s.visitor_id)::int as visitors,
      count(*)::int as sessions,
      sum(s.pageviews)::int as pageviews,
      avg(${BOUNCE}::int)::float as bounce_rate,
      avg(s.engaged_ms)::float as session_duration,
      count(*) filter (where s.converted)::int as conversions,
      (count(*) filter (where s.converted))::float / count(*) as conversion_rate,
      count(*) over ()::int as total
    from s
    group by s.key
    order by ${BREAKDOWN_SORTS[sort]} ${dir === "asc" ? "asc" : "desc"} nulls last, key
    limit ${q.p(limit)} offset ${q.p(page * limit)}
  `);
  return {
    total: Number(rows[0]?.total ?? 0),
    rows: rows.map((row) => ({
      key: row.key === null ? null : String(row.key),
      visitors: Number(row.visitors),
      sessions: Number(row.sessions),
      pageviews: Number(row.pageviews),
      bounceRate: Number(row.bounce_rate ?? 0),
      sessionDuration: Number(row.session_duration ?? 0),
      conversions: Number(row.conversions),
      conversionRate: Number(row.conversion_rate ?? 0),
    })),
  };
}

/** Visitors in the period seen for the first time, and those who had been before. */
export async function loadNewVsReturning(filters: Filters): Promise<{ new: number; returning: number }> {
  "use cache";
  cacheLife("minutes");
  cacheTag(DB_TAG);
  const q = new Query();
  const [row] = await q.rows<Record<string, number>>(`
    with ev as (select e.visitor_id, e.kind from analytics_events e where ${scope(q, filters, filters.period)}),
    v as (select distinct visitor_id from ev where kind = 'pageview'),
    f as (
      select a.visitor_id, min(a.created_at) as first_seen
      from analytics_events a join v on v.visitor_id = a.visitor_id
      group by a.visitor_id
    )
    select
      count(*) filter (where f.first_seen >= (${q.p(filters.period.start)}::date)::timestamp at time zone ${tz(q)})::int as new_visitors,
      count(*) filter (where f.first_seen < (${q.p(filters.period.start)}::date)::timestamp at time zone ${tz(q)})::int as returning_visitors
    from f
  `);
  return { new: Number(row?.new_visitors ?? 0), returning: Number(row?.returning_visitors ?? 0) };
}

export interface EventRow {
  name: string;
  total: number;
  visitors: number;
  sessions: number;
}

export async function loadEvents(filters: Filters): Promise<EventRow[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(DB_TAG);
  const q = new Query();
  const rows = await q.rows<Record<string, string | number>>(`
    select e.name, count(*)::int as total, count(distinct e.visitor_id)::int as visitors, count(distinct e.session_id)::int as sessions
    from analytics_events e
    where ${scope(q, filters, filters.period)} and e.kind = 'event'
    group by e.name
    order by total desc, e.name
  `);
  return rows.map((row) => ({
    name: String(row.name),
    total: Number(row.total),
    visitors: Number(row.visitors),
    sessions: Number(row.sessions),
  }));
}

export interface PropRow {
  key: string;
  value: string;
  total: number;
  visitors: number;
}

/** One event's properties, e.g. which links an outbound click went to. */
export async function loadEventProps(filters: Filters, name: string): Promise<PropRow[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(DB_TAG);
  const q = new Query();
  const rows = await q.rows<Record<string, string | number>>(`
    select p.key, p.value, count(*)::int as total, count(distinct e.visitor_id)::int as visitors
    from analytics_events e, jsonb_each_text(e.props) p
    where ${scope(q, filters, filters.period)} and e.kind = 'event' and e.name = ${q.p(name)}
    group by 1, 2
    order by total desc, 1, 2
    limit 100
  `);
  return rows.map((row) => ({
    key: String(row.key),
    value: String(row.value),
    total: Number(row.total),
    visitors: Number(row.visitors),
  }));
}

export interface GoalRow {
  goal: Goal;
  /** Every time it was completed. */
  completions: number;
  visitors: number;
  /** Sessions that completed it at least once. */
  conversions: number;
  conversionRate: number;
}

/** Each goal's completions and conversion rate over the sessions in the period. */
export async function loadGoals(filters: Filters, period: Period = filters.period): Promise<GoalRow[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(GOALS_TAG, DB_TAG);
  const goals = await listGoals();
  if (!goals.length) return [];
  const q = new Query();
  const parts = goals.map(
    (goal, i) => `
      select ${i} as idx, count(*)::int as completions, count(distinct e.visitor_id)::int as visitors,
        count(distinct e.session_id)::int as conversions
      from ev e where ${goalMatch(q, goal)}`,
  );
  const rows = await q.rows<Record<string, number>>(`
    with ev as (
      select e.session_id, e.visitor_id, e.kind, e.name, e.path
      from analytics_events e where ${scope(q, filters, period)}
    ),
    total as (select count(distinct session_id)::int as sessions from ev where kind = 'pageview'),
    g as (${parts.join(" union all ")})
    select g.*, total.sessions from g, total
  `);
  return rows
    .map((row) => {
      const sessions = Number(row.sessions);
      const conversions = Number(row.conversions);
      return {
        goal: goals[Number(row.idx)],
        completions: Number(row.completions),
        visitors: Number(row.visitors),
        conversions,
        conversionRate: sessions ? conversions / sessions : 0,
      };
    })
    .sort((a, b) => b.conversions - a.conversions || a.goal.label.localeCompare(b.goal.label));
}

export interface FlowRow {
  key: string;
  total: number;
}

/** Where sessions came to a page from and went to after it, by route; `null` is the session's start or end. */
export async function loadPageFlow(
  filters: Filters,
  column: "route" | "path",
  value: string,
): Promise<{ previous: FlowRow[]; next: FlowRow[] }> {
  "use cache";
  cacheLife("minutes");
  cacheTag(DB_TAG);
  const q = new Query();
  const rows = await q.rows<Record<string, string | number | null>>(`
    with ev as (
      select e.session_id, e.created_at, e.route, e.path
      from analytics_events e where ${scope(q, filters, filters.period, { pages: false })} and e.kind = 'pageview'
    ),
    seq as (
      select e.route, e.path,
        lag(e.route) over w as previous_route,
        lead(e.route) over w as next_route
      from ev e
      window w as (partition by e.session_id order by e.created_at)
    ),
    hits as (select * from seq where ${column} = ${q.p(value)})
    (select 'previous' as side, previous_route as key, count(*)::int as total from hits group by 2 order by 3 desc limit 10)
    union all
    (select 'next' as side, next_route as key, count(*)::int as total from hits group by 2 order by 3 desc limit 10)
  `);
  const side = (name: string) =>
    rows.filter((row) => row.side === name).map((row) => ({ key: row.key === null ? "" : String(row.key), total: Number(row.total) }));
  return { previous: side("previous"), next: side("next") };
}

export interface RealtimeActivity {
  createdAt: Date;
  kind: "pageview" | "event";
  name: string;
  path: string;
  country: string | null;
  city: string | null;
  device: string | null;
  channel: string | null;
  referrer: string | null;
  signedIn: boolean;
}

export interface Realtime {
  active: number;
  /** Pageviews in each of the last 30 minutes, oldest first. */
  minutes: number[];
  pages: FlowRow[];
  sources: FlowRow[];
  countries: FlowRow[];
  recent: RealtimeActivity[];
}

/** The last few minutes: who's on the site, where, and from where. */
export async function loadRealtime(team: boolean): Promise<Realtime> {
  const teamFilter = team ? "true" : "not e.is_team";
  const recent = `e.created_at > now() - interval '${REALTIME_MINUTES} minutes'`;
  const sql = (text: string) => db().query(text) as Promise<Record<string, unknown>[]>;
  const [active, minutes, pages, sources, countries, latest] = await Promise.all([
    sql(`select count(distinct e.visitor_id)::int as n from analytics_events e where ${recent} and ${teamFilter}`),
    sql(`
      select m.minute, count(e.id)::int as n
      from generate_series(date_trunc('minute', now()) - interval '29 minutes', date_trunc('minute', now()), interval '1 minute') as m (minute)
      left join analytics_events e
        on e.kind = 'pageview' and ${teamFilter} and e.created_at >= m.minute and e.created_at < m.minute + interval '1 minute'
      group by m.minute order by m.minute
    `),
    sql(`
      select route as key, count(*)::int as total from (
        select distinct on (e.visitor_id) e.route from analytics_events e
        where ${recent} and ${teamFilter} and e.kind = 'pageview'
        order by e.visitor_id, e.created_at desc
      ) x group by 1 order by 2 desc, 1 limit 10
    `),
    sql(`
      select coalesce(e.referrer_host, e.channel, 'Direct') as key, count(distinct e.visitor_id)::int as total
      from analytics_events e where ${recent} and ${teamFilter}
      group by 1 order by 2 desc, 1 limit 10
    `),
    sql(`
      select coalesce(e.country, '') as key, count(distinct e.visitor_id)::int as total
      from analytics_events e where ${recent} and ${teamFilter}
      group by 1 order by 2 desc, 1 limit 10
    `),
    sql(`
      select e.created_at, e.kind, e.name, e.path, e.country, e.city, e.device, e.channel, e.referrer_host, e.user_id
      from analytics_events e
      where e.created_at > now() - interval '30 minutes' and ${teamFilter}
      order by e.created_at desc limit 30
    `),
  ]);
  const flow = (rows: Record<string, unknown>[]) =>
    rows.map((row) => ({ key: String(row.key ?? ""), total: Number(row.total) }));
  return {
    active: Number(active[0]?.n ?? 0),
    minutes: minutes.map((row) => Number(row.n)),
    pages: flow(pages),
    sources: flow(sources),
    countries: flow(countries),
    recent: latest.map((row) => ({
      createdAt: row.created_at instanceof Date ? row.created_at : new Date(String(row.created_at)),
      kind: row.kind === "event" ? "event" : "pageview",
      name: String(row.name),
      path: String(row.path),
      country: row.country === null ? null : String(row.country),
      city: row.city === null ? null : String(row.city),
      device: row.device === null ? null : String(row.device),
      channel: row.channel === null ? null : String(row.channel),
      referrer: row.referrer_host === null ? null : String(row.referrer_host),
      signedIn: row.user_id !== null,
    })),
  };
}

/** Visitors over the last `days`, everyone but the team, for the team dashboard's card. */
export async function loadVisitorSummary(days: number): Promise<{
  visitors: number;
  previous: number;
  pageviews: number;
  points: { day: string; value: number }[];
}> {
  const filters = lastDays(days);
  const [kpis, series] = await Promise.all([loadKpis(filters), loadTimeseries(filters)]);
  return {
    visitors: kpis.current.visitors,
    previous: kpis.previous.visitors,
    pageviews: kpis.current.pageviews,
    points: series.current.filter((point) => !point.future).map((point) => ({ day: point.bucket.slice(0, 10), value: point.visitors })),
  };
}
