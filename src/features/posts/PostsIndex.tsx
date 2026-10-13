import "server-only";
import type { ReactElement } from "react";
import Link from "next/link";
import tabs from "@/features/data-room/room.module.css";
import ui from "@/features/data-room/ui.module.css";
import { loadAllPosts } from "@/features/portal/data";
import { Empty, PageHeader, PostList } from "@/features/portal/sections";
import { requireTeam } from "@/features/zrm/access";
import styles from "@/features/portal/portal.module.css";
import { createPostAction } from "./actions";
import admin from "./PostEditor.module.css";
import { POST_KINDS, kindLabel, type PostKind } from "./types";

const TABS = [
  { id: "all", label: "All", href: "/portal/posts" },
  ...POST_KINDS.map((kind) => ({ id: kind.id, label: kind.label, href: `/portal/posts/${kind.id}` })),
];

const SUBTITLES: Record<PostKind | "all", string> = {
  all: "News and changelog entries on the public site.",
  news: "Announcements on the public News page.",
  changelog: "Features, improvements and fixes on the public Changelog.",
};

/** News and changelog posts, drafts included, or one kind of them. ZODE team only. */
export async function PostsIndex({ kind }: { kind: PostKind | null }): Promise<ReactElement> {
  await requireTeam(kind ? `/portal/posts/${kind}` : "/portal/posts");
  const posts = await loadAllPosts();
  const shown = posts && kind ? posts.filter((post) => post.kind === kind) : posts;

  return (
    <div className={styles.page}>
      <PageHeader title={kind ? kindLabel(kind) : "Posts"} subtitle={SUBTITLES[kind ?? "all"]}>
        <form action={createPostAction} className={admin.actions}>
          <button className={kind === "changelog" ? ui.primary : ui.button} type="submit" name="kind" value="changelog">
            New changelog entry
          </button>
          <button className={kind === "changelog" ? ui.button : ui.primary} type="submit" name="kind" value="news">
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
            aria-current={(kind ?? "all") === tab.id ? "page" : undefined}
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
        <Empty>
          {kind === "news"
            ? "No news posts yet. Start one with the button above."
            : kind === "changelog"
              ? "No changelog entries yet. Start one with the button above."
              : "No posts yet. Start one with the buttons above."}
        </Empty>
      )}
    </div>
  );
}
