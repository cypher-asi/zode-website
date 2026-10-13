import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { BreakdownTable, ReportTabs } from "@/features/analytics/Breakdown";
import { hrefWith, param, type Dimension, type SearchParams } from "@/features/analytics/filters";
import { formatValue } from "@/features/analytics/format";
import { HowWeMeasure } from "@/features/analytics/HowWeMeasure";
import { BREAKDOWN_SORTS, loadBreakdown, loadNewVsReturning } from "@/features/analytics/queries";
import { ANALYTICS_PATH, openReport, sortingOf } from "@/features/analytics/report";
import { Toolbar } from "@/features/analytics/Toolbar";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { Empty, PageHeader } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";
import a from "@/features/analytics/analytics.module.css";

export const metadata: Metadata = {
  title: "Audience | Analytics | ZODE",
  robots: { index: false, follow: false },
};

const PATH = `${ANALYTICS_PATH}/audience`;

const TABS = [
  { id: "country", label: "Countries", column: "Country" },
  { id: "region", label: "Regions", column: "Region" },
  { id: "city", label: "Cities", column: "City" },
  { id: "device", label: "Devices", column: "Device" },
  { id: "browser", label: "Browsers", column: "Browser" },
  { id: "os", label: "Operating systems", column: "OS" },
  { id: "language", label: "Languages", column: "Language" },
] as const satisfies readonly { id: Dimension; label: string; column: string }[];

/** Who visits: where they are, what they browse with, and whether they've been before. */
export default function AnalyticsAudiencePage({ searchParams }: { searchParams: Promise<SearchParams> }): ReactElement {
  return (
    <div className={styles.page}>
      <PageHeader title="Audience" subtitle="Where visitors are, what they use, and how many come back." />
      <Suspense fallback={<PortalLoading header={false} nested />}>
        <Audience searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Audience({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<ReactElement> {
  const { filters, search } = await openReport(searchParams, PATH);
  const tab = TABS.find((option) => option.id === param(search, "by")) ?? TABS[0];
  const sorting = sortingOf(search, BREAKDOWN_SORTS, "visitors");
  const keep = { by: tab.id === "country" ? undefined : tab.id };

  let data;
  try {
    const [breakdown, visitors] = await Promise.all([loadBreakdown(filters, tab.id, sorting), loadNewVsReturning(filters)]);
    data = { breakdown, visitors };
  } catch (error) {
    console.error("[analytics] audience failed", error);
  }
  const total = data ? data.visitors.new + data.visitors.returning : 0;

  return (
    <>
      <Toolbar path={PATH} filters={filters} keep={keep} />
      {data ? (
        <>
          <div className={a.split}>
            <div className={a.kpis}>
              <div className={a.kpi} title="Visitors seen for the first time in this range.">
                <span className={a.kpiLabel}>New visitors</span>
                <span className={a.kpiValue}>{formatValue(data.visitors.new, "count", { short: true })}</span>
                <span className={a.kpiChange}>{formatValue(total ? data.visitors.new / total : null, "percent")} of visitors</span>
              </div>
            </div>
            <div className={a.kpis}>
              <div className={a.kpi} title="Visitors who had visited before this range began.">
                <span className={a.kpiLabel}>Returning visitors</span>
                <span className={a.kpiValue}>{formatValue(data.visitors.returning, "count", { short: true })}</span>
                <span className={a.kpiChange}>
                  {formatValue(total ? data.visitors.returning / total : null, "percent")} of visitors
                </span>
              </div>
            </div>
          </div>
          <div className={a.sectionHead}>
            <ReportTabs
              label="Breakdown"
              current={tab.id}
              tabs={TABS.map((option) => ({
                id: option.id,
                label: option.label,
                href: hrefWith(PATH, filters, {}, { by: option.id === "country" ? null : option.id }),
              }))}
            />
          </div>
          <BreakdownTable
            path={PATH}
            filters={filters}
            dim={tab.id}
            dimLabel={tab.column}
            data={data.breakdown}
            keep={keep}
            {...sorting}
          />
        </>
      ) : (
        <Empty>The audience couldn&apos;t be loaded right now. Please try again shortly.</Empty>
      )}
      <HowWeMeasure />
    </>
  );
}
