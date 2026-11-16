import "server-only";
import type { ReactElement } from "react";
import Link from "next/link";
import { Panel } from "@/features/analytics/BarList";
import { hrefWith, lastDays } from "@/features/analytics/filters";
import { KpiStrip } from "@/features/analytics/KpiStrip";
import { loadPostStats, loadTimeseries, type PostStats } from "@/features/analytics/queries";
import { ANALYTICS_PATH, chartPoints, previousValues } from "@/features/analytics/report";
import { TimeSeriesChart } from "@/features/analytics/TimeSeriesChart";
import { Empty } from "@/features/portal/sections";
import { postHref, type Post } from "./types";
import a from "@/features/analytics/analytics.module.css";

const DAYS = 30;

const ZERO: PostStats = { path: "", visitors: 0, pageviews: 0, engagedTime: 0, scrollDepth: 0, readRate: null, signups: 0 };

/**
 * A post's readership over the last 30 days, beside its editor: headline
 * figures against the 30 days before, and daily views. Drafts have no page
 * yet, so nothing to show. The caller has already checked the viewer is team.
 */
export async function PostAnalytics({ post }: { post: Post }): Promise<ReactElement | null> {
  if (post.status !== "published") return null;
  const path = postHref(post.kind, post.slug);
  const filters = { ...lastDays(DAYS), dims: { path } };

  let data;
  try {
    const [current, previous, series] = await Promise.all([
      loadPostStats(filters, [path]),
      loadPostStats(filters, [path], filters.previous),
      loadTimeseries(filters),
    ]);
    data = { now: current[0] ?? ZERO, before: previous[0] ?? ZERO, series };
  } catch (error) {
    console.error("[posts] analytics failed", error);
  }

  return (
    <section className={a.postAnalytics} aria-label="Readership">
      <Panel title={`Readership, last ${DAYS} days`} wide>
        {data ? (
          <>
            <KpiStrip
              items={[
                { metric: "visitors", value: data.now.visitors, previous: data.before.visitors, unit: "count" },
                { metric: "pageviews", value: data.now.pageviews, previous: data.before.pageviews, unit: "count" },
                { metric: "engaged_time", value: data.now.engagedTime, previous: data.before.engagedTime, unit: "duration" },
                {
                  metric: "scroll_depth",
                  value: data.now.scrollDepth / 100,
                  previous: data.before.scrollDepth / 100,
                  unit: "percent",
                },
                { metric: "read_rate", value: data.now.readRate, previous: data.before.readRate, unit: "percent" },
                { metric: "signups", value: data.now.signups, previous: data.before.signups, unit: "count" },
              ]}
            />
            <TimeSeriesChart
              title="Views per day"
              unit="count"
              points={chartPoints(data.series.current, "pageviews", filters)}
              previous={previousValues(data.series.previous, "pageviews")}
            />
            <p className={a.postAnalyticsMore}>
              <Link href={hrefWith(`${ANALYTICS_PATH}/pages/detail`, filters)}>Full report in Analytics</Link>
              {" · "}
              <Link href={`${ANALYTICS_PATH}/posts`}>All posts</Link>
            </p>
          </>
        ) : (
          <Empty>This post&apos;s analytics couldn&apos;t be loaded right now.</Empty>
        )}
      </Panel>
    </section>
  );
}
