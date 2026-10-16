import type { ReactElement, ReactNode } from "react";
import { io } from "next/cache";
import Link from "next/link";
import { isZodeAdmin } from "@/features/account/admin";
import type { Account } from "@/features/account/zos";
import { loadVisitorSummary } from "@/features/analytics/queries";
import { Empty } from "@/features/portal/sections";
import dash from "./dashboard.module.css";
import { MetricCard } from "./MetricCard";
import { CAPACITY_STATUSES, loadTeamMetrics, type TeamMetrics } from "./metrics";
import { MixChart } from "./MixChart";

const RANGES = [
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
  { days: 365, label: "1y" },
] as const;

const DEFAULT_RANGE = 90;

/** The range `?range=` asks for, in days, if it's one on offer. */
export function rangeDays(requested: string | string[] | undefined): number {
  const days = Number(requested);
  return RANGES.some((range) => range.days === days) ? days : DEFAULT_RANGE;
}

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

function DashboardSection({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <section aria-label={title}>
      <h2 className={dash.sectionTitle}>{title}</h2>
      <div className={dash.grid}>{children}</div>
    </section>
  );
}

/**
 * The ZODE team's figures at a glance, Home's Team tab, in three sections:
 * the capacity pipeline with its MW by status (statuses with none left out);
 * the sales pipeline of opportunities and contracts; and the growth engine of
 * subscribers and visitors, each with its history.
 * `account` must already be checked to be on the team.
 */
export async function TeamDashboard({
  account,
  rangeDays = DEFAULT_RANGE,
}: {
  account: Account;
  rangeDays?: number;
}): Promise<ReactElement> {
  // The ranges and the Neon driver read the clock, which a prerender can't.
  await io();
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
        <div className={dash.sections}>
          <DashboardSection title="Capacity Pipeline">
            <MetricCard
              label="Capacity pipeline"
              href="/portal/capacity/sites"
              value={metrics.current.capacity_pipeline_mw}
              format={megawatts}
              detail={`${megawatts(metrics.current.capacity_contracted_mw)} contracted or closed`}
              points={metrics.series.capacity_pipeline_mw}
              rangeDays={rangeDays}
              wide
              aside={
                <MixChart
                  mixes={[
                    { id: "deal", label: "Deal type", slices: metrics.capacityMix.dealType },
                    { id: "type", label: "Type", slices: metrics.capacityMix.siteType },
                  ]}
                />
              }
            >
              <dl className={dash.breakdown}>
                {CAPACITY_STATUSES.toReversed()
                  .filter(({ metric }) => metrics.current[metric] > 0)
                  .map(({ status, metric }) => (
                    <div key={metric}>
                      <dt>{status}</dt>
                      <dd>{megawatts(metrics.current[metric])}</dd>
                    </div>
                  ))}
              </dl>
            </MetricCard>
          </DashboardSection>
          <DashboardSection title="Sales Pipeline">
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
          </DashboardSection>
          <DashboardSection title="Growth Engine">
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
                weekly={rangeDays === 365}
              />
            ) : null}
          </DashboardSection>
        </div>
      )}
    </>
  );
}
