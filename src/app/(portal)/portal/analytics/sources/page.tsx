import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { BreakdownTable, ReportTabs } from "@/features/analytics/Breakdown";
import { hrefWith, param, type Dimension, type SearchParams } from "@/features/analytics/filters";
import { HowWeMeasure } from "@/features/analytics/HowWeMeasure";
import { BREAKDOWN_SORTS, loadBreakdown } from "@/features/analytics/queries";
import { ANALYTICS_PATH, openReport, sortingOf } from "@/features/analytics/report";
import { Toolbar } from "@/features/analytics/Toolbar";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { Empty, PageHeader } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";
import a from "@/features/analytics/analytics.module.css";

export const metadata: Metadata = {
  title: "Sources | Analytics | ZODE",
  robots: { index: false, follow: false },
};

const PATH = `${ANALYTICS_PATH}/sources`;

const TABS = [
  { id: "channel", label: "Channels", column: "Channel" },
  { id: "referrer", label: "Referrers", column: "Referrer" },
  { id: "utm_campaign", label: "Campaigns", column: "Campaign" },
  { id: "utm_source", label: "UTM source", column: "Source" },
  { id: "utm_medium", label: "UTM medium", column: "Medium" },
  { id: "utm_content", label: "UTM content", column: "Content" },
  { id: "utm_term", label: "UTM term", column: "Term" },
] as const satisfies readonly { id: Dimension; label: string; column: string }[];

/** Where visits come from: channel, referring site and campaign, with how each converts. */
export default function AnalyticsSourcesPage({ searchParams }: { searchParams: Promise<SearchParams> }): ReactElement {
  return (
    <div className={styles.page}>
      <PageHeader title="Sources" subtitle="Where visits come from, and how well each source converts." />
      <Suspense fallback={<PortalLoading header={false} nested />}>
        <Sources searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Sources({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<ReactElement> {
  const { filters, search } = await openReport(searchParams, PATH);
  const tab = TABS.find((option) => option.id === param(search, "by")) ?? TABS[0];
  const sorting = sortingOf(search, BREAKDOWN_SORTS, "visitors");
  const keep = { by: tab.id === "channel" ? undefined : tab.id };

  let data;
  try {
    data = await loadBreakdown(filters, tab.id, sorting);
  } catch (error) {
    console.error("[analytics] sources failed", error);
  }

  return (
    <>
      <Toolbar path={PATH} filters={filters} keep={keep} />
      <div className={a.sectionHead}>
        <ReportTabs
          label="Source"
          current={tab.id}
          tabs={TABS.map((option) => ({
            id: option.id,
            label: option.label,
            href: hrefWith(PATH, filters, {}, { by: option.id === "channel" ? null : option.id }),
          }))}
        />
      </div>
      {data ? (
        <BreakdownTable path={PATH} filters={filters} dim={tab.id} dimLabel={tab.column} data={data} keep={keep} {...sorting} />
      ) : (
        <Empty>The sources couldn&apos;t be loaded right now. Please try again shortly.</Empty>
      )}
      <HowWeMeasure />
    </>
  );
}
