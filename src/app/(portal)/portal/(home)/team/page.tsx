import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import Link from "next/link";
import { isZodeAdmin } from "@/features/account/admin";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { Empty } from "@/features/portal/sections";
import dash from "@/features/team-dashboard/dashboard.module.css";
import { loadVisitorSummary } from "@/features/analytics/queries";
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

/** Visitors against the period before, since a day's visitors aren't a running total to compare end to end. */
function visitorChange(current: number, previous: number, days: number) {
  const label = RANGES.find((range) => range.days === days)?.label ?? `${days}d`;
  if (!previous) return { text: current ? `New since the previous ${label}` : "No visitors yet", trend: "flat" as const };
  const pct = Math.round(((current - previous) / previous) * 100);
  return {
    text: `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${Math.abs(pct)}% on the previous ${label}`,
    trend: pct > 0 ? ("up" as const) : pct < 0 ? ("down" as const) : ("flat" as const),
  };
}

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * The ZODE team's figures at a glance, Home's Team tab: capacity, the
 * opportunity pipeline, contracts and subscribers, each with its history.
 * The layout holds the header.
 */
export default function TeamDashboardPage({ searchParams }: { searchParams: SearchParams }): ReactElement {
  return (
    <Suspense fallback={<PortalLoading header={false} nested />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: { searchParams: SearchParams }): Promise<ReactElement> {
  const account = await requireTeam("/portal/team");
  const requested = Number((await searchParams).range);
  const rangeDays = RANGES.some((range) => range.days === requested) ? requested : DEFAULT_RANGE;
  const [metrics, admin, visitors] = await Promise.all([
    loadTeamMetrics(rangeDays).catch((error: unknown): TeamMetrics | null => {
      console.error("Failed to load team metrics", error);
      return null;
    }),
    isZodeAdmin(account),
    loadVisitorSummary(rangeDays).catch((error: unknown) => {
      console.error("Failed to load visitors", error);
      return null;
    }),
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
          {visitors ? (
            <MetricCard
              label="Visitors"
              href={rangeDays === 30 ? "/portal/analytics" : rangeDays === 90 ? "/portal/analytics?range=90d" : "/portal/analytics?range=12mo"}
              value={visitors.visitors}
              format={count}
              detail={`${count(visitors.pageviews)} pageviews on the site and portal`}
              points={visitors.points}
              rangeDays={rangeDays}
              change={visitorChange(visitors.visitors, visitors.previous, rangeDays)}
            />
          ) : null}
        </div>
      )}
    </>
  );
}
