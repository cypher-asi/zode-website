import "server-only";
import { requireTeam } from "@/features/zrm/access";
import { bucketFor, param, parseFilters, type Filters, type SearchParams } from "./filters";
import { bucketLabels } from "./format";
import type { ChartPoint } from "./TimeSeriesChart";
import type { SeriesMetric, SeriesPoint, Sorting } from "./queries";

export const ANALYTICS_PATH = "/portal/analytics";

/** Team only, like the rest of the team's apps: the report's filters once the viewer is checked. */
export async function openReport(searchParams: Promise<SearchParams>, path: string): Promise<{ filters: Filters; search: SearchParams }> {
  await requireTeam(path);
  const search = await searchParams;
  return { filters: parseFilters(search), search };
}

/** The sort the URL asks for, if it's one the report offers, else its default. */
export function sortingOf<S extends string>(search: SearchParams, sorts: Record<S, string>, fallback: S): Sorting<S> {
  const sort = param(search, "sort");
  const dir = param(search, "dir");
  const page = Math.max(0, Math.floor(Number(param(search, "page")) || 0));
  return {
    sort: sort && Object.hasOwn(sorts, sort) ? (sort as S) : fallback,
    dir: dir === "asc" ? "asc" : dir === "desc" ? "desc" : fallback === "key" ? "asc" : "desc",
    page,
  };
}

/** One metric of a series as the chart's points, with buckets still to come left empty. */
export function chartPoints(series: SeriesPoint[], metric: SeriesMetric, filters: Filters): ChartPoint[] {
  const unit = bucketFor(filters.period);
  return series.map((point) => ({
    ...bucketLabels(point.bucket, unit),
    value: point.future ? null : point[metric],
  }));
}

export const previousValues = (series: SeriesPoint[], metric: SeriesMetric): (number | null)[] =>
  series.map((point) => point[metric]);
