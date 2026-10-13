import type { Metadata } from "next";
import type { ReactElement } from "react";
import { PostsIndex } from "@/features/posts/PostsIndex";

export const metadata: Metadata = {
  title: "Posts | ZODE",
  robots: { index: false, follow: false },
};

/** Every news and changelog post, drafts included. ZODE team only. */
export default function PostsPage(): ReactElement {
  return <PostsIndex kind={null} />;
}
