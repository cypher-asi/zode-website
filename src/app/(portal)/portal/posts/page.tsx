import type { Metadata } from "next";
import type { ReactElement } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isZodeAdmin } from "@/features/account/admin";
import { requireAccount } from "@/features/account/session";
import { loadAllPosts } from "@/features/portal/data";
import { Empty, PageHeader, PostList } from "@/features/portal/sections";
import { createPostAction } from "@/features/posts/actions";
import { POST_KINDS, isPostKind } from "@/features/posts/types";
import tabs from "@/features/data-room/room.module.css";
import ui from "@/features/data-room/ui.module.css";
import styles from "@/features/portal/portal.module.css";
import admin from "@/features/posts/PostEditor.module.css";

export const metadata: Metadata = {
  title: "Posts | ZODE",
  robots: { index: false, follow: false },
};

const TABS = [{ id: "all", label: "All", href: "/portal/posts" }, ...POST_KINDS.map((kind) => ({
  ...kind,
  href: `/portal/posts?kind=${kind.id}`,
}))];

/** News and changelog posts, drafts included. ZODE admins only. */
export default async function PostsPage({ searchParams }: PageProps<"/portal/posts">): Promise<ReactElement> {
  const account = await requireAccount("/portal/posts");
  if (!(await isZodeAdmin(account))) notFound();
  const { kind } = await searchParams;
  const filter = isPostKind(kind) ? kind : null;
  const posts = await loadAllPosts();
  const shown = posts && filter ? posts.filter((post) => post.kind === filter) : posts;

  return (
    <div className={styles.page}>
      <PageHeader title="Posts" subtitle="News and changelog entries on the public site.">
        <form action={createPostAction} className={admin.actions}>
          <button className={ui.button} type="submit" name="kind" value="changelog">
            New changelog entry
          </button>
          <button className={ui.primary} type="submit" name="kind" value="news">
            New news post
          </button>
        </form>
      </PageHeader>
      <nav className={admin.filter} aria-label="Post kinds">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            className={tabs.tab}
            aria-current={(filter ?? "all") === tab.id ? "page" : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {shown === null ? (
        <Empty>Posts couldn&apos;t be loaded right now. Please try again shortly.</Empty>
      ) : shown.length ? (
        <PostList posts={shown} />
      ) : (
        <Empty>No posts yet. Start one with the buttons above.</Empty>
      )}
    </div>
  );
}
