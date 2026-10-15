import "server-only";
import { Suspense, type ReactElement } from "react";
import ui from "@/features/data-room/ui.module.css";
import { loadAllPosts } from "@/features/portal/data";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { Empty, PostList } from "@/features/portal/sections";
import { TabbedPageHeader, type HeaderTab } from "@/features/portal/TabbedPageHeader";
import { requireTeam } from "@/features/zrm/access";
import { createPostAction } from "./actions";
import { POST_KINDS, kindLabel, type PostKind } from "./types";

const NEW_POST_FORM = "new-post";

const SUBTITLES: Record<PostKind | "all", string> = {
  all: "News and changelog entries on the public site.",
  news: "Announcements on the public News page.",
  changelog: "Features, improvements and fixes on the public Changelog.",
};

/** The new-post buttons for a tab: both on All, the tab's own kind on News and Changelog. */
function NewPostButtons({ kind }: { kind: PostKind | null }): ReactElement {
  return (
    <>
      {kind !== "news" ? (
        <button className={kind ? ui.primary : ui.button} form={NEW_POST_FORM} type="submit" name="kind" value="changelog">
          New changelog entry
        </button>
      ) : null}
      {kind !== "changelog" ? (
        <button className={ui.primary} form={NEW_POST_FORM} type="submit" name="kind" value="news">
          New news post
        </button>
      ) : null}
    </>
  );
}

/** The Posts header, its tabs for every post and each kind, and the buttons that start one. */
export function PostsHeader(): ReactElement {
  const tabs: HeaderTab[] = [
    { href: "/portal/posts", label: "All", title: "Posts", subtitle: SUBTITLES.all, actions: <NewPostButtons kind={null} /> },
    ...POST_KINDS.map((kind) => ({
      href: `/portal/posts/${kind.id}`,
      label: kind.label,
      title: kindLabel(kind.id),
      subtitle: SUBTITLES[kind.id],
      actions: <NewPostButtons kind={kind.id} />,
    })),
  ];
  return (
    <>
      {/* The buttons sit beside the tabs, not inside the form, so the header sizes them like its other actions. */}
      <form id={NEW_POST_FORM} action={createPostAction} hidden />
      <TabbedPageHeader tabs={tabs} label="Post kinds" />
    </>
  );
}

/** News and changelog posts, drafts included, or one kind of them. ZODE team only. */
export function PostsIndex({ kind }: { kind: PostKind | null }): ReactElement {
  return (
    <Suspense fallback={<PortalLoading header={false} nested />}>
      <Posts kind={kind} />
    </Suspense>
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
