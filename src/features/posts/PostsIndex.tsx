import "server-only";
import { Suspense, type ReactElement } from "react";
import Link from "next/link";
import tabs from "@/features/data-room/room.module.css";
import ui from "@/features/data-room/ui.module.css";
import { loadAllPosts } from "@/features/portal/data";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { Empty, PageHeader, PostList } from "@/features/portal/sections";
import { requireTeam } from "@/features/zrm/access";
import styles from "@/features/portal/portal.module.css";
import { createPostAction } from "./actions";
import { POST_KINDS, kindLabel, type PostKind } from "./types";

const TABS = [
  { id: "all", label: "All", href: "/portal/posts" },
  ...POST_KINDS.map((kind) => ({ id: kind.id, label: kind.label, href: `/portal/posts/${kind.id}` })),
];

const NEW_POST_FORM = "new-post";

const SUBTITLES: Record<PostKind | "all", string> = {
  all: "News and changelog entries on the public site.",
  news: "Announcements on the public News page.",
  changelog: "Features, improvements and fixes on the public Changelog.",
};

/** News and changelog posts, drafts included, or one kind of them. ZODE team only. */
export function PostsIndex({ kind }: { kind: PostKind | null }): ReactElement {
  return (
    <div className={styles.page}>
      <PageHeader
        title={kind ? kindLabel(kind) : "Posts"}
        subtitle={SUBTITLES[kind ?? "all"]}
        tabs={
          <nav className={tabs.tabs} aria-label="Post kinds">
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
        }
        actions={
          <>
            {/* The buttons sit beside the tabs, not inside the form, so the header sizes them like its other actions. */}
            <form id={NEW_POST_FORM} action={createPostAction} hidden />
            {kind !== "news" ? (
              <button
                className={kind ? ui.primary : ui.button}
                form={NEW_POST_FORM}
                type="submit"
                name="kind"
                value="changelog"
              >
                New changelog entry
              </button>
            ) : null}
            {kind !== "changelog" ? (
              <button className={ui.primary} form={NEW_POST_FORM} type="submit" name="kind" value="news">
                New news post
              </button>
            ) : null}
          </>
        }
      />
      <Suspense fallback={<PortalLoading header={false} nested />}>
        <Posts kind={kind} />
      </Suspense>
    </div>
  );
}

async function Posts({ kind }: { kind: PostKind | null }): Promise<ReactElement> {
  await requireTeam(kind ? `/portal/posts/${kind}` : "/portal/posts");
  const posts = await loadAllPosts();
  const shown = posts && kind ? posts.filter((post) => post.kind === kind) : posts;
  return shown === null ? (
    <Empty>Posts couldn&apos;t be loaded right now. Please try again shortly.</Empty>
  ) : shown.length ? (
    <PostList posts={shown} />
  ) : (
    <Empty>
      {kind === "news"
        ? "No news posts yet. Start one with New news post."
        : kind === "changelog"
          ? "No changelog entries yet. Start one with New changelog entry."
          : "No posts yet. Start one with the buttons at the top."}
    </Empty>
  );
}
