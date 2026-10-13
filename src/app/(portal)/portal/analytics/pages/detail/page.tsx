import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import Link from "next/link";
import { BarList, Panel } from "@/features/analytics/BarList";
import { hrefWith, NONE, type SearchParams } from "@/features/analytics/filters";
import { dimensionLabel } from "@/features/analytics/format";
import { HowWeMeasure } from "@/features/analytics/HowWeMeasure";
import { KpiStrip } from "@/features/analytics/KpiStrip";
import { loadBreakdown, loadPageFlow, loadPages, loadTimeseries, type PageRow } from "@/features/analytics/queries";
import { ANALYTICS_PATH, chartPoints, openReport, previousValues } from "@/features/analytics/report";
import { TimeSeriesChart } from "@/features/analytics/TimeSeriesChart";
import { Toolbar } from "@/features/analytics/Toolbar";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { Empty, PageHeader } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";
import a from "@/features/analytics/analytics.module.css";

export const metadata: Metadata = {
  title: "Page | Analytics | ZODE",
  robots: { index: false, follow: false },
};

const PATH = `${ANALYTICS_PATH}/pages/detail`;
const TOP = { sort: "visitors", dir: "desc", page: 0 } as const;

const EMPTY_ROW: PageRow = {
  key: "",
  visitors: 0,
  pageviews: 0,
  engagedTime: 0,
  scrollDepth: 0,
  entries: 0,
  exits: 0,
  bounceRate: null,
};

/** One page, or one exact path: its figures and trend, how people got there and where they went next. */
export default function AnalyticsPageDetailPage({ searchParams }: { searchParams: Promise<SearchParams> }): ReactElement {
  return (
    <div className={styles.page}>
      <PageHeader title="Page" subtitle="One page's readership, trend and the paths through it." />
      <Suspense fallback={<PortalLoading header={false} nested />}>
        <Detail searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Detail({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<ReactElement> {
  const { filters } = await openReport(searchParams, PATH);
  const column = filters.dims.path ? "path" : filters.dims.route ? "route" : null;
  if (!column) {
    return (
      <Empty>
        Pick a page from <Link href={hrefWith(`${ANALYTICS_PATH}/pages`, filters)}>Pages</Link> to see it here.
      </Empty>
    );
  }
  const value = filters.dims[column]!;

  let data;
  try {
    const [current, previous, series, paths, flow, channels, countries] = await Promise.all([
      loadPages(filters, column, TOP),
      loadPages(filters, column, TOP, filters.previous),
      loadTimeseries(filters),
      column === "route" ? loadPages(filters, "path", TOP) : null,
      loadPageFlow(filters, column, value),
      loadBreakdown(filters, "channel", TOP, 8),
      loadBreakdown(filters, "country", TOP, 8),
    ]);
    data = { current, previous, series, paths, flow, channels, countries };
  } catch (error) {
    console.error("[analytics] page detail failed", error);
  }
  if (!data) {
    return (
      <>
        <Toolbar path={PATH} filters={filters} />
        <Empty>This page&apos;s figures couldn&apos;t be loaded right now. Please try again shortly.</Empty>
      </>
    );
  }

  const now = data.current.rows[0] ?? EMPTY_ROW;
  const before = data.previous.rows[0] ?? EMPTY_ROW;
  const flowRows = (rows: { key: string; total: number }[], ends: string) =>
    rows.map((row) => ({
      key: row.key || NONE,
      label: row.key || ends,
      value: row.total,
      href: row.key ? hrefWith(PATH, filters, { dims: { path: null, route: row.key } }) : undefined,
    }));

  return (
    <>
      <Toolbar path={PATH} filters={filters} />
      <KpiStrip
        items={[
          { metric: "visitors", value: now.visitors, previous: before.visitors, unit: "count" },
          { metric: "pageviews", value: now.pageviews, previous: before.pageviews, unit: "count" },
          { metric: "engaged_time", value: now.engagedTime, previous: before.engagedTime, unit: "duration" },
          { metric: "scroll_depth", value: now.scrollDepth / 100, previous: before.scrollDepth / 100, unit: "percent" },
          { metric: "entries", value: now.entries, previous: before.entries, unit: "count" },
          { metric: "exits", value: now.exits, previous: before.exits, unit: "count" },
          { metric: "bounce_rate", value: now.bounceRate, previous: before.bounceRate, unit: "percent" },
        ]}
      />
      <TimeSeriesChart
        title={`Pageviews of ${value}`}
        unit="count"
        points={chartPoints(data.series.current, "pageviews", filters)}
        previous={previousValues(data.series.previous, "pageviews")}
      />
      <div className={a.panels}>
        <Panel title="Came from">
          <BarList label="Previous page" valueLabel="Views" rows={flowRows(data.flow.previous, "Entered the site here")} />
        </Panel>
        <Panel title="Went to">
          <BarList label="Next page" valueLabel="Views" rows={flowRows(data.flow.next, "Left the site")} />
        </Panel>
        <Panel title="Channels">
          <BarList
            label="Channel"
            valueLabel="Visitors"
            rows={data.channels.rows.map((row) => ({
              key: row.key ?? NONE,
              label: dimensionLabel("channel", row.key),
              value: row.visitors,
              href: hrefWith(PATH, filters, { dims: { channel: row.key ?? NONE } }),
            }))}
          />
        </Panel>
        <Panel title="Countries">
          <BarList
            label="Country"
            valueLabel="Visitors"
            rows={data.countries.rows.map((row) => ({
              key: row.key ?? NONE,
              label: dimensionLabel("country", row.key),
              value: row.visitors,
              href: hrefWith(PATH, filters, { dims: { country: row.key ?? NONE } }),
            }))}
          />
        </Panel>
        {data.paths ? (
          <Panel title="Paths" wide>
            <BarList
              label="Path"
              valueLabel="Visitors"
              rows={data.paths.rows.slice(0, 15).map((row) => ({
                key: row.key,
                label: row.key,
                value: row.visitors,
                detail: `${row.pageviews.toLocaleString("en-US")} views`,
                href: hrefWith(PATH, filters, { dims: { route: null, path: row.key } }),
              }))}
            />
          </Panel>
        ) : null}
      </div>
      <HowWeMeasure />
    </>
  );
}
