import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { notFound } from "next/navigation";
import { LazyPostEditor } from "@/features/posts/LazyPostEditor";
import { PostAnalytics } from "@/features/posts/PostAnalytics";
import { getPost } from "@/features/posts/posts";
import { requireTeam } from "@/features/zrm/access";
import styles from "@/features/portal/portal.module.css";

export const metadata: Metadata = {
  title: "Edit post | ZODE",
  robots: { index: false, follow: false },
};

export default async function EditPostPage({ params }: PageProps<"/portal/posts/[postId]">): Promise<ReactElement> {
  const { postId } = await params;
  await requireTeam(`/portal/posts/${postId}`);
  const post = await getPost(postId);
  if (!post) notFound();

  return (
    <div className={styles.page}>
      <LazyPostEditor key={post.id} post={post} />
      {/* Streams in after the editor, so slow analytics never hold it up. */}
      <Suspense fallback={null}>
        <PostAnalytics post={post} />
      </Suspense>
    </div>
  );
}
