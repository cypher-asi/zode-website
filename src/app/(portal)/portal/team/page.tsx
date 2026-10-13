import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import Link from "next/link";
import { isZodeAdmin } from "@/features/account/admin";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { Empty, PageHeader } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";
import dash from "@/features/team-dashboard/dashboard.module.css";
import { HomeTabs } from "@/features/team-dashboard/HomeTabs";
import { MetricCard } from "@/features/team-dashboard/MetricCard";
import { loadTeamMetrics, type TeamMetrics } from "@/features/team-dashboard/metrics";
import { requireTeam } from "@/features/zrm/access";

export const metadata: Metadata = {
  title: "Team | Portal | ZODE",
  robots: { index: false, follow: false },
};

const RANGES = [
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
  { days: 365, label: "1y" },
] as const;

const DEFAULT_RANGE = 90;

const count = (value: number) => Math.round(value).toLocaleString("en-US");
const megawatts = (value: number) => `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })} MW`;
const dollars = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * The ZODE team's figures at a glance, Home's Team tab: capacity, the
 * opportunity pipeline, contracts and subscribers, each with its history.
 */
export default function TeamDashboardPage({ searchParams }: { searchParams: SearchParams }): ReactElement {
  return (
    <div className={styles.page}>
      <PageHeader
        title="Team dashboard"
        subtitle="ZODE's capacity, pipeline, contracts and audience, tracked daily."
        tabs={<HomeTabs current="team" />}
      />
      <Suspense fallback={<PortalLoading header={false} nested />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Dashboard({ searchParams }: { searchParams: SearchParams }): Promise<ReactElement> {
  const account = await requireTeam("/portal/team");
  const requested = Number((await searchParams).range);
  const rangeDays = RANGES.some((range) => range.days === requested) ? requested : DEFAULT_RANGE;
  const [metrics, admin] = await Promise.all([
    loadTeamMetrics(rangeDays).catch((error: unknown): TeamMetrics | null => {
      console.error("Failed to load team metrics", error);
      return null;
    }),
    isZodeAdmin(account),
  ]);

  return (
    <>
      <div className={dash.toolbar}>
        <h2 className={dash.toolbarTitle}>Last {RANGES.find((range) => range.days === rangeDays)?.label}</h2>
        <nav className={dash.ranges} aria-label="Range">
          {RANGES.map((range) => (
            <Link
              key={range.days}
              href={range.days === DEFAULT_RANGE ? "/portal/team" : `/portal/team?range=${range.days}`}
              className={dash.range}
              aria-current={range.days === rangeDays ? "page" : undefined}
            >
              {range.label}
            </Link>
          ))}
        </nav>
      </div>

      {metrics === null ? (
        <Empty>The team&apos;s figures couldn&apos;t be loaded right now. Please try again shortly.</Empty>
      ) : (
        <>
          <div className={dash.grid}>
            <MetricCard
              label="Capacity contracted"
              href="/portal/capacity/sites"
              value={metrics.current.capacity_contracted_mw}
              format={megawatts}
              detail={`${megawatts(metrics.current.capacity_pipeline_mw)} in the pipeline`}
              points={metrics.series.capacity_contracted_mw}
              rangeDays={rangeDays}
            />
            <MetricCard
              label="Open opportunities"
              href="/portal/zrm/opportunities"
              value={metrics.current.opportunities_open}
              format={count}
              detail={`${dollars(metrics.current.opportunities_pipeline_usd)} in open pipeline value`}
              points={metrics.series.opportunities_open}
              rangeDays={rangeDays}
            />
            <MetricCard
              label="Contracts"
              href="/portal/contracts/all"
              value={metrics.current.contracts_total}
              format={count}
              detail={`${count(metrics.current.contracts_compute)} compute · ${megawatts(metrics.current.contracts_compute_mw)} · ${count(
                metrics.current.contracts_total - metrics.current.contracts_compute,
              )} MNDA`}
              points={metrics.series.contracts_total}
              rangeDays={rangeDays}
            />
            <MetricCard
              label="Subscribers"
              href={admin ? "/portal/subscribers" : undefined}
              value={metrics.current.subscribers_confirmed}
              format={count}
              detail={`${count(metrics.current.subscribers_news)} news · ${count(metrics.current.subscribers_changelog)} changelog`}
              points={metrics.series.subscribers_confirmed}
              rangeDays={rangeDays}
            />
          </div>
          <p className={dash.note}>
            Capacity contracted counts sites that are Contracted or Live. An opportunity stays open until it reaches the
            last stage. Subscribers are confirmed emails on either list. Figures are snapshotted every day.
          </p>
        </>
      )}
    </>
  );
}
