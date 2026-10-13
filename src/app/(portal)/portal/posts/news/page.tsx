import type { Metadata } from "next";
import type { ReactElement } from "react";
import { PostsIndex } from "@/features/posts/PostsIndex";

export const metadata: Metadata = {
  title: "News posts | ZODE",
  robots: { index: false, follow: false },
};

/** News posts, drafts included. ZODE team only. */
export default function NewsPostsPage(): ReactElement {
  return <PostsIndex kind="news" />;
}
