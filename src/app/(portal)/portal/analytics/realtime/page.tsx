import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import Link from "next/link";
import { AutoRefresh } from "@/features/analytics/AutoRefresh";
import { BarList, Panel } from "@/features/analytics/BarList";
import { REALTIME_MINUTES } from "@/features/analytics/definitions";
import { eventLabel } from "@/features/analytics/events";
import { param, type SearchParams } from "@/features/analytics/filters";
import { countryLabel, timeOfDay } from "@/features/analytics/format";
import { loadRealtime, type Realtime } from "@/features/analytics/queries";
import { ANALYTICS_PATH } from "@/features/analytics/report";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { Empty, PageHeader } from "@/features/portal/sections";
import { requireTeam } from "@/features/zrm/access";
import styles from "@/features/portal/portal.module.css";
import a from "@/features/analytics/analytics.module.css";

export const metadata: Metadata = {
  title: "Realtime | Analytics | ZODE",
  robots: { index: false, follow: false },
};

const PATH = `${ANALYTICS_PATH}/realtime`;
const REFRESH_SECONDS = 15;

/** Who's on the site right now, refreshed every few seconds. */
export default function AnalyticsRealtimePage({ searchParams }: { searchParams: Promise<SearchParams> }): ReactElement {
  return (
    <div className={styles.page}>
      <PageHeader title="Realtime" subtitle={`Visitors in the last ${REALTIME_MINUTES} minutes, updated every ${REFRESH_SECONDS} seconds.`} />
      <Suspense fallback={<PortalLoading header={false} nested />}>
        <Live searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const where = (row: Realtime["recent"][number]) =>
  [row.city, row.country ? countryLabel(row.country) : null, row.device].filter(Boolean).join(" · ");

async function Live({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<ReactElement> {
  await requireTeam(PATH);
  const team = param(await searchParams, "team") === "include";

  let data: Realtime | null = null;
  try {
    data = await loadRealtime(team);
  } catch (error) {
    console.error("[analytics] realtime failed", error);
  }

  const peak = data ? Math.max(1, ...data.minutes) : 1;

  return (
    <>
      <AutoRefresh seconds={REFRESH_SECONDS} />
      <div className={a.toolbar}>
        <p className={a.period}>Right now</p>
        <div className={a.segments}>
          <Link
            href={team ? PATH : `${PATH}?team=include`}
            className={a.segment}
            aria-pressed={team}
            title="The ZODE team's own visits are left out unless included."
          >
            {team ? "Including team" : "Excluding team"}
          </Link>
        </div>
      </div>
      {data ? (
        <div className={a.panels}>
          <Panel title="Active visitors" wide>
            <p className={a.live}>
              <span className={a.pulse} aria-hidden="true" />
              {data.active.toLocaleString("en-US")}
              <small>on the site now</small>
            </p>
            <div className={a.minutes} role="img" aria-label="Pageviews in each of the last 30 minutes">
              {data.minutes.map((count, i) => (
                <span
                  key={i}
                  className={a.minute}
                  data-empty={count === 0 ? "" : undefined}
                  style={{ height: `${Math.max(3, (count / peak) * 100)}%` }}
                  title={`${count} pageview${count === 1 ? "" : "s"}, ${30 - i} min ago`}
                />
              ))}
            </div>
            <div className={a.minutesAxis} aria-hidden="true">
              <span>30 min ago</span>
              <span>Now</span>
            </div>
          </Panel>
          <Panel title="Pages now">
            <BarList label="Page" valueLabel="Visitors" rows={data.pages.map((row) => ({ key: row.key, label: row.key, value: row.total }))} empty="Nobody's reading right now." />
          </Panel>
          <Panel title="Sources now">
            <BarList label="Source" valueLabel="Visitors" rows={data.sources.map((row) => ({ key: row.key, label: row.key, value: row.total }))} empty="No visitors right now." />
          </Panel>
          <Panel title="Countries now">
            <BarList
              label="Country"
              valueLabel="Visitors"
              rows={data.countries.map((row) => ({ key: row.key || "unknown", label: countryLabel(row.key || null), value: row.total }))}
              empty="No visitors right now."
            />
          </Panel>
          <Panel title="Latest activity">
            {data.recent.length ? (
              <ul className={a.feed}>
                {data.recent.map((row, i) => (
                  <li key={`${row.createdAt.getTime()}-${i}`}>
                    <span className={a.feedTime}>{timeOfDay(row.createdAt)}</span>
                    <span className={a.feedWhat} title={row.path}>
                      {row.kind === "event" ? `${eventLabel(row.name)} on ${row.path}` : row.path}
                    </span>
                    <span className={a.feedWho}>
                      {where(row)}
                      {row.signedIn ? " · Signed in" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={a.none}>Nothing in the last 30 minutes.</p>
            )}
          </Panel>
        </div>
      ) : (
        <Empty>Realtime couldn&apos;t be loaded right now. It&apos;ll try again in a moment.</Empty>
      )}
    </>
  );
}
