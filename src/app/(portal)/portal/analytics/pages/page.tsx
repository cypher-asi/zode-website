import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import Link from "next/link";
import { ReportTabs } from "@/features/analytics/Breakdown";
import { hrefWith, param, type SearchParams } from "@/features/analytics/filters";
import { formatValue } from "@/features/analytics/format";
import { HowWeMeasure } from "@/features/analytics/HowWeMeasure";
import { loadPages, PAGE_SIZE, PAGE_SORTS, type PageSort } from "@/features/analytics/queries";
import { ReportTable, type Column } from "@/features/analytics/ReportTable";
import { ANALYTICS_PATH, openReport, sortingOf } from "@/features/analytics/report";
import { Toolbar } from "@/features/analytics/Toolbar";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { Empty, PageHeader } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";
import a from "@/features/analytics/analytics.module.css";

export const metadata: Metadata = {
  title: "Pages | Analytics | ZODE",
  robots: { index: false, follow: false },
};

const PATH = `${ANALYTICS_PATH}/pages`;

const COLUMNS: Column<PageSort>[] = [
  { id: "key", label: "Page" },
  { id: "visitors", label: "Visitors", metric: "visitors" },
  { id: "pageviews", label: "Pageviews", metric: "pageviews" },
  { id: "engaged_time", label: "Time on page", metric: "engaged_time" },
  { id: "scroll_depth", label: "Scroll depth", metric: "scroll_depth" },
  { id: "entries", label: "Entries", metric: "entries" },
  { id: "exits", label: "Exits", metric: "exits" },
  { id: "bounce_rate", label: "Bounce rate", metric: "bounce_rate" },
];

/** Every page, by route or exact path, with how it was read and how sessions started and ended on it. */
export default function AnalyticsPagesPage({ searchParams }: { searchParams: Promise<SearchParams> }): ReactElement {
  return (
    <div className={styles.page}>
      <PageHeader title="Pages" subtitle="What's read, for how long and how far, and where visits start and end." />
      <Suspense fallback={<PortalLoading header={false} nested />}>
        <Pages searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Pages({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<ReactElement> {
  const { filters, search } = await openReport(searchParams, PATH);
  const group = param(search, "group") === "path" ? "path" : "route";
  const { sort, dir, page } = sortingOf(search, PAGE_SORTS, "visitors");
  const keep = { group: group === "path" ? "path" : undefined };

  let data;
  try {
    data = await loadPages(filters, group, { sort, dir, page });
  } catch (error) {
    console.error("[analytics] pages failed", error);
  }

  return (
    <>
      <Toolbar path={PATH} filters={filters} keep={{ ...keep, sort: param(search, "sort"), dir: param(search, "dir") }} />
      <div className={a.sectionHead}>
        <ReportTabs
          label="Group pages"
          current={group}
          tabs={[
            { id: "route", label: "By page", href: hrefWith(PATH, filters) },
            { id: "path", label: "By exact path", href: hrefWith(PATH, filters, {}, { group: "path" }) },
          ]}
        />
      </div>
      {data ? (
        <ReportTable
          columns={COLUMNS.map((column) => (column.id === "key" ? { ...column, label: group === "path" ? "Path" : "Page" } : column))}
          rows={data.rows.map((row) => ({
            key: row.key,
            cells: [
              <Link
                key="key"
                className={a.cellLink}
                href={hrefWith(`${PATH}/detail`, filters, { dims: { [group]: row.key } })}
                title={row.key}
              >
                {row.key}
              </Link>,
              formatValue(row.visitors, "count"),
              formatValue(row.pageviews, "count"),
              formatValue(row.engagedTime, "duration"),
              formatValue(row.scrollDepth / 100, "percent"),
              formatValue(row.entries, "count"),
              formatValue(row.exits, "count"),
              formatValue(row.bounceRate, "percent"),
            ],
          }))}
          sort={sort}
          dir={dir}
          sortHref={(column, next) => hrefWith(PATH, filters, {}, { ...keep, sort: column, dir: next })}
          page={page}
          pageSize={PAGE_SIZE}
          total={data.total}
          pageHref={(next) => hrefWith(PATH, filters, {}, { ...keep, sort, dir, page: next || null })}
        />
      ) : (
        <Empty>The pages couldn&apos;t be loaded right now. Please try again shortly.</Empty>
      )}
      <HowWeMeasure />
    </>
  );
}
