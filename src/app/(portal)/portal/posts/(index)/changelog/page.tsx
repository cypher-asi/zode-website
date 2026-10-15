import type { Metadata } from "next";
import type { ReactElement } from "react";
import { PostsIndex } from "@/features/posts/PostsIndex";

export const metadata: Metadata = {
  title: "Changelog posts | ZODE",
  robots: { index: false, follow: false },
};

/** Changelog entries, drafts included. ZODE team only. */
export default function ChangelogPostsPage(): ReactElement {
  return <PostsIndex kind="changelog" />;
}
