import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { BarList, Panel } from "@/features/analytics/BarList";
import { METRIC_DEFINITIONS, type MetricId } from "@/features/analytics/definitions";
import { hrefWith, NONE, param, type Dimension, type Filters, type SearchParams } from "@/features/analytics/filters";
import { dimensionLabel, formatValue, type Unit } from "@/features/analytics/format";
import { HowWeMeasure } from "@/features/analytics/HowWeMeasure";
import { KpiStrip } from "@/features/analytics/KpiStrip";
import {
  loadBreakdown,
  loadGoals,
  loadKpis,
  loadPages,
  loadTimeseries,
  type BreakdownRow,
  type SeriesMetric,
} from "@/features/analytics/queries";
import { ANALYTICS_PATH, chartPoints, openReport, previousValues } from "@/features/analytics/report";
import { TimeSeriesChart } from "@/features/analytics/TimeSeriesChart";
import { Toolbar } from "@/features/analytics/Toolbar";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { Empty, PageHeader } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";
import a from "@/features/analytics/analytics.module.css";

export const metadata: Metadata = {
  title: "Analytics | Portal | ZODE",
  robots: { index: false, follow: false },
};

const CHART_METRICS: { metric: SeriesMetric; id: MetricId; unit: Unit }[] = [
  { metric: "visitors", id: "visitors", unit: "count" },
  { metric: "sessions", id: "sessions", unit: "count" },
  { metric: "pageviews", id: "pageviews", unit: "count" },
  { metric: "bounceRate", id: "bounce_rate", unit: "percent" },
  { metric: "sessionDuration", id: "session_duration", unit: "duration" },
];

const TOP = { sort: "visitors", dir: "desc", page: 0 } as const;
const TOP_ROWS = 8;

/** The site's and portal's traffic at a glance: headline figures, their trend and the top of every breakdown. */
export default function AnalyticsOverviewPage({ searchParams }: { searchParams: Promise<SearchParams> }): ReactElement {
  return (
    <div className={styles.page}>
      <PageHeader title="Analytics" subtitle="Traffic, sources and conversions across the site and portal." />
      <Suspense fallback={<PortalLoading header={false} nested />}>
        <Overview searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function breakdownBars(rows: BreakdownRow[], dim: Dimension, filters: Filters, metric: string | undefined) {
  return rows.slice(0, TOP_ROWS).map((row) => ({
    key: row.key ?? NONE,
    label: dimensionLabel(dim, row.key),
    value: row.visitors,
    href: hrefWith(ANALYTICS_PATH, filters, { dims: { [dim]: row.key ?? NONE } }, { metric }),
  }));
}

async function Overview({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<ReactElement> {
  const { filters, search } = await openReport(searchParams, ANALYTICS_PATH);
  const chosen = CHART_METRICS.find((option) => option.metric === param(search, "metric")) ?? CHART_METRICS[0];
  const metric = chosen.metric === "visitors" ? undefined : chosen.metric;
  const keep = { metric };

  let data;
  try {
    const [kpis, series, pages, channels, referrers, countries, devices, goals] = await Promise.all([
      loadKpis(filters),
      loadTimeseries(filters),
      loadPages(filters, "route", TOP),
      loadBreakdown(filters, "channel", TOP, TOP_ROWS),
      loadBreakdown(filters, "referrer", TOP, TOP_ROWS),
      loadBreakdown(filters, "country", TOP, TOP_ROWS),
      loadBreakdown(filters, "device", TOP, TOP_ROWS),
      loadGoals(filters),
    ]);
    data = { kpis, series, pages, channels, referrers, countries, devices, goals };
  } catch (error) {
    console.error("[analytics] overview failed", error);
    return (
      <>
        <Toolbar path={ANALYTICS_PATH} filters={filters} keep={keep} />
        <Empty>The analytics couldn&apos;t be loaded right now. Please try again shortly.</Empty>
      </>
    );
  }
  const { kpis, series, pages, channels, referrers, countries, devices, goals } = data;
  const { current, previous } = kpis;
  const chartHref = (option: SeriesMetric) =>
    hrefWith(ANALYTICS_PATH, filters, {}, { metric: option === "visitors" ? null : option });
  const reportHref = (path: string) => hrefWith(`${ANALYTICS_PATH}/${path}`, filters);

  return (
    <>
      <Toolbar path={ANALYTICS_PATH} filters={filters} keep={keep} />
      <KpiStrip
        items={[
          ...CHART_METRICS.slice(0, 3).map((option) => ({
            metric: option.id,
            value: current[option.metric],
            previous: previous[option.metric],
            unit: option.unit,
            href: chartHref(option.metric),
            selected: option.metric === chosen.metric,
          })),
          {
            metric: "views_per_session",
            value: current.viewsPerSession,
            previous: previous.viewsPerSession,
            unit: "decimal",
          },
          ...CHART_METRICS.slice(3).map((option) => ({
            metric: option.id,
            value: current[option.metric],
            previous: previous[option.metric],
            unit: option.unit,
            href: chartHref(option.metric),
            selected: option.metric === chosen.metric,
          })),
          ...(goals.length
            ? [
                {
                  metric: "conversion_rate" as const,
                  value: current.conversionRate,
                  previous: previous.conversionRate,
                  unit: "percent" as const,
                },
              ]
            : []),
        ]}
      />
      <TimeSeriesChart
        title={`${METRIC_DEFINITIONS[chosen.id].label} over time`}
        unit={chosen.unit}
        points={chartPoints(series.current, chosen.metric, filters)}
        previous={previousValues(series.previous, chosen.metric)}
      />
      <div className={a.panels}>
        <Panel title="Top pages" href={reportHref("pages")}>
          <BarList
            label="Page"
            valueLabel="Visitors"
            rows={pages.rows.slice(0, TOP_ROWS).map((row) => ({
              key: row.key,
              label: row.key,
              value: row.visitors,
              href: hrefWith(`${ANALYTICS_PATH}/pages/detail`, filters, { dims: { route: row.key } }),
            }))}
          />
        </Panel>
        <Panel title="Channels" href={reportHref("sources")}>
          <BarList label="Channel" valueLabel="Visitors" rows={breakdownBars(channels.rows, "channel", filters, metric)} />
        </Panel>
        <Panel title="Referrers" href={hrefWith(`${ANALYTICS_PATH}/sources`, filters, {}, { by: "referrer" })}>
          <BarList label="Referrer" valueLabel="Visitors" rows={breakdownBars(referrers.rows, "referrer", filters, metric)} />
        </Panel>
        <Panel title="Countries" href={reportHref("audience")}>
          <BarList label="Country" valueLabel="Visitors" rows={breakdownBars(countries.rows, "country", filters, metric)} />
        </Panel>
        <Panel title="Devices" href={hrefWith(`${ANALYTICS_PATH}/audience`, filters, {}, { by: "device" })}>
          <BarList label="Device" valueLabel="Visitors" rows={breakdownBars(devices.rows, "device", filters, metric)} />
        </Panel>
        <Panel title="Goals" href={reportHref("events")}>
          <BarList
            label="Goal"
            valueLabel="Conversions"
            empty="No goals yet. Add one under Events & goals."
            rows={goals.map((row) => ({
              key: String(row.goal.id),
              label: row.goal.label,
              value: row.conversions,
              detail: formatValue(row.conversionRate, "percent"),
            }))}
          />
        </Panel>
      </div>
      <HowWeMeasure />
    </>
  );
}
