import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import Link from "next/link";
import { DIMENSIONS, hrefWith, type Dimension, type Filters, type SearchParams } from "@/features/analytics/filters";
import { formatValue } from "@/features/analytics/format";
import { HowWeMeasure } from "@/features/analytics/HowWeMeasure";
import { loadPostStats, type PostStats } from "@/features/analytics/queries";
import { ANALYTICS_PATH, openReport } from "@/features/analytics/report";
import { Toolbar } from "@/features/analytics/Toolbar";
import { loadAllPosts } from "@/features/portal/data";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { Empty, PageHeader } from "@/features/portal/sections";
import { kindLabel, postHref, type Post } from "@/features/posts/types";
import styles from "@/features/portal/portal.module.css";
import a from "@/features/analytics/analytics.module.css";

export const metadata: Metadata = {
  title: "Posts | Analytics | ZODE",
  robots: { index: false, follow: false },
};

const PATH = `${ANALYTICS_PATH}/posts`;

const EMPTY: Omit<PostStats, "path"> = {
  visitors: 0,
  pageviews: 0,
  engagedTime: 0,
  scrollDepth: 0,
  readRate: null,
  signups: 0,
};

/** Every published news post and changelog entry, with how it was read. */
export default function AnalyticsPostsPage({ searchParams }: { searchParams: Promise<SearchParams> }): ReactElement {
  return (
    <div className={styles.page}>
      <PageHeader title="Posts" subtitle="How each news post and changelog entry is read." />
      <Suspense fallback={<PortalLoading header={false} nested />}>
        <Posts searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Posts({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<ReactElement> {
  const { filters: requested } = await openReport(searchParams, PATH);
  // Each row is a page of its own, so a page filter carried over from another report would zero the table.
  const dims = Object.fromEntries(
    Object.entries(requested.dims).filter(([dim]) => !DIMENSIONS[dim as Dimension].page),
  ) as Filters["dims"];
  const filters: Filters = { ...requested, dims };

  const [stats, posts] = await Promise.all([
    loadPostStats(filters).catch((error: unknown): PostStats[] | undefined => {
      console.error("[analytics] posts failed", error);
      return undefined;
    }),
    loadAllPosts(),
  ]);

  if (!stats) {
    return (
      <>
        <Toolbar path={PATH} filters={filters} />
        <Empty>Post analytics couldn&apos;t be loaded right now. Please try again shortly.</Empty>
      </>
    );
  }

  // Published posts first, joined to their figures by path; paths without a current post (renamed or removed) follow.
  const byPath = new Map(stats.map((row) => [row.path, row]));
  const published = (posts ?? []).filter((post) => post.status === "published");
  const known = new Set(published.map((post) => postHref(post.kind, post.slug)));
  const rows: { key: string; post: Post | null; stats: Omit<PostStats, "path">; path: string }[] = [
    ...published.map((post) => {
      const path = postHref(post.kind, post.slug);
      return { key: post.id, post, path, stats: byPath.get(path) ?? EMPTY };
    }),
    ...stats.filter((row) => !known.has(row.path)).map((row) => ({ key: row.path, post: null, path: row.path, stats: row })),
  ].sort((x, y) => y.stats.pageviews - x.stats.pageviews);

  return (
    <>
      <Toolbar path={PATH} filters={filters} />
      {rows.length ? (
        <div className={a.tableWrap}>
          <table className={a.table}>
            <thead>
              <tr>
                <th scope="col">Post</th>
                <th scope="col">Kind</th>
                <th scope="col">Visitors</th>
                <th scope="col">Views</th>
                <th scope="col">Time on page</th>
                <th scope="col">Scroll depth</th>
                <th scope="col">Read rate</th>
                <th scope="col">Sign-ups</th>
                <th scope="col">Edit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>
                    <Link
                      className={a.cellLink}
                      href={hrefWith(`${ANALYTICS_PATH}/pages/detail`, filters, { dims: { path: row.path } })}
                      title={row.path}
                    >
                      {row.post?.title || row.path}
                    </Link>
                  </td>
                  <td>{row.post ? kindLabel(row.post.kind) : row.path.startsWith("/news/") ? "News" : "Changelog"}</td>
                  <td>{formatValue(row.stats.visitors, "count")}</td>
                  <td>{formatValue(row.stats.pageviews, "count")}</td>
                  <td>{formatValue(row.stats.engagedTime, "duration")}</td>
                  <td>{formatValue(row.stats.scrollDepth / 100, "percent")}</td>
                  <td>{formatValue(row.stats.readRate, "percent")}</td>
                  <td>{formatValue(row.stats.signups, "count")}</td>
                  <td>
                    {row.post ? (
                      <Link className={a.cellLink} href={`/portal/posts/${row.post.id}`}>
                        Edit
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>No published posts yet.</Empty>
      )}
      <HowWeMeasure />
    </>
  );
}
