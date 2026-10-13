import { AREAS, type Area } from "./classify";
import { TIME_ZONE } from "./definitions";

/**
 * A report's state, all in the URL so every view can be bookmarked and
 * shared: the range, the area, whether the team's own traffic counts, and
 * any dimension filters picked by clicking a row.
 */

export const RANGES = [
  { id: "today", label: "Today", days: 1 },
  { id: "7d", label: "7d", days: 7 },
  { id: "30d", label: "30d", days: 30 },
  { id: "90d", label: "90d", days: 90 },
  { id: "12mo", label: "12mo", days: 365 },
] as const;

export type RangeId = (typeof RANGES)[number]["id"] | "custom";

export const DEFAULT_RANGE: RangeId = "30d";

/** Every dimension a report can be filtered or broken down by, with the column it reads. */
export const DIMENSIONS = {
  route: { label: "Page", column: "e.route", page: true },
  path: { label: "Path", column: "e.path", page: true },
  area: { label: "Area", column: "e.area", page: false },
  channel: { label: "Channel", column: "e.channel", page: false },
  referrer: { label: "Referrer", column: "e.referrer_host", page: false },
  utm_source: { label: "UTM source", column: "e.utm_source", page: false },
  utm_medium: { label: "UTM medium", column: "e.utm_medium", page: false },
  utm_campaign: { label: "Campaign", column: "e.utm_campaign", page: false },
  utm_content: { label: "UTM content", column: "e.utm_content", page: false },
  utm_term: { label: "UTM term", column: "e.utm_term", page: false },
  country: { label: "Country", column: "e.country", page: false },
  region: { label: "Region", column: "e.region", page: false },
  city: { label: "City", column: "e.city", page: false },
  device: { label: "Device", column: "e.device", page: false },
  browser: { label: "Browser", column: "e.browser", page: false },
  os: { label: "OS", column: "e.os", page: false },
  language: { label: "Language", column: "e.language", page: false },
} as const;

export type Dimension = keyof typeof DIMENSIONS;

const FILTERABLE = (Object.keys(DIMENSIONS) as Dimension[]).filter((dim) => dim !== "area");

/** A filter value meaning "not set", e.g. no referrer. */
export const NONE = "(none)";

export interface Period {
  /** First day, `YYYY-MM-DD`, inclusive. */
  start: string;
  /** Last day, inclusive. */
  end: string;
  days: number;
}

export interface Filters {
  range: RangeId;
  period: Period;
  /** The same number of days just before `period`, for comparison. */
  previous: Period;
  area: Area | null;
  /** Count the ZODE team's own traffic too. */
  team: boolean;
  dims: Partial<Record<Dimension, string>>;
}

export type SearchParams = Record<string, string | string[] | undefined>;

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CUSTOM_DAYS = 3 * 366;

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

/** Today's date in the reports' time zone. */
export const today = (): string => dayFormat.format(new Date());

const toMs = (day: string) => Date.parse(`${day}T00:00:00Z`);
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (day: string, days: number): string => fromMs(toMs(day) + days * DAY_MS);
const daysBetween = (start: string, end: string) => Math.round((toMs(end) - toMs(start)) / DAY_MS) + 1;

const validDay = (value: unknown): value is string =>
  typeof value === "string" && DATE_RE.test(value) && !Number.isNaN(toMs(value)) && fromMs(toMs(value)) === value;

const one = (search: SearchParams, key: string): string | undefined => {
  const value = search[key];
  return typeof value === "string" ? value : undefined;
};

function periodOf(range: RangeId, search: SearchParams): { range: RangeId; period: Period } {
  const end = today();
  if (range === "custom") {
    const from = one(search, "from");
    const to = one(search, "to");
    if (validDay(from) && validDay(to) && from <= to && to <= end) {
      const days = daysBetween(from, to);
      if (days <= MAX_CUSTOM_DAYS) return { range, period: { start: from, end: to, days } };
    }
    range = DEFAULT_RANGE;
  }
  const { days } = RANGES.find((option) => option.id === range)!;
  return { range, period: { start: addDays(end, 1 - days), end, days } };
}

export function parseFilters(search: SearchParams): Filters {
  const requested = one(search, "range");
  const range: RangeId =
    requested === "custom" || RANGES.some((option) => option.id === requested) ? (requested as RangeId) : DEFAULT_RANGE;
  const { range: resolved, period } = periodOf(range, search);
  const previous = { start: addDays(period.start, -period.days), end: addDays(period.start, -1), days: period.days };
  const area = one(search, "area");
  const dims: Filters["dims"] = {};
  for (const dim of FILTERABLE) {
    const value = one(search, dim);
    if (value) dims[dim] = value.slice(0, 300);
  }
  return {
    range: resolved,
    period,
    previous,
    area: AREAS.some((option) => option.id === area) ? (area as Area) : null,
    team: one(search, "team") === "include",
    dims,
  };
}

/** Filters for a fixed number of days ending today, everyone but the team, for summaries outside the app. */
export function lastDays(days: number): Filters {
  const end = today();
  const period = { start: addDays(end, 1 - days), end, days };
  return {
    range: "custom",
    period,
    previous: { start: addDays(period.start, -days), end: addDays(period.start, -1), days },
    area: null,
    team: false,
    dims: {},
  };
}

/** The params that describe `filters`, leaving out defaults so links stay short. */
function paramsOf(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.range === "custom") {
    params.set("range", "custom");
    params.set("from", filters.period.start);
    params.set("to", filters.period.end);
  } else if (filters.range !== DEFAULT_RANGE) {
    params.set("range", filters.range);
  }
  if (filters.area) params.set("area", filters.area);
  if (filters.team) params.set("team", "include");
  for (const [dim, value] of Object.entries(filters.dims)) params.set(dim, value);
  return params;
}

export type FilterChange = Partial<Omit<Filters, "dims" | "period" | "previous">> & {
  dims?: Partial<Record<Dimension, string | null>>;
};

/**
 * A link to `path` with the filters changed, plus extra params like a sort
 * or tab (`null` drops one). Changing filters drops the page number.
 */
export function hrefWith(
  path: string,
  filters: Filters,
  change: FilterChange = {},
  extra: Record<string, string | number | null | undefined> = {},
): string {
  const dims = { ...filters.dims };
  for (const [dim, value] of Object.entries(change.dims ?? {})) {
    if (value === null || value === undefined) delete dims[dim as Dimension];
    else dims[dim as Dimension] = value;
  }
  const params = paramsOf({ ...filters, ...change, dims } as Filters);
  for (const [key, value] of Object.entries(extra)) {
    if (value === null || value === undefined || value === "") params.delete(key);
    else params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/** Report-specific params, e.g. `sort`, kept alongside the filters. */
export function param(search: SearchParams, key: string): string | undefined {
  return one(search, key);
}

/** How finely the chart buckets a period. */
export type Bucket = "hour" | "day" | "week";

export function bucketFor(period: Period): Bucket {
  if (period.days <= 2) return "hour";
  return period.days <= 120 ? "day" : "week";
}
