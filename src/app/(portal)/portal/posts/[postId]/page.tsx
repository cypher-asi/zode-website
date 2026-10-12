import type { Metadata } from "next";
import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { isZodeAdmin } from "@/features/account/admin";
import { requireAccount } from "@/features/account/session";
import { PostEditor } from "@/features/posts/PostEditor";
import { getPost } from "@/features/posts/posts";
import styles from "@/features/portal/portal.module.css";

export const metadata: Metadata = {
  title: "Edit post | ZODE",
  robots: { index: false, follow: false },
};

export default async function EditPostPage({ params }: PageProps<"/portal/posts/[postId]">): Promise<ReactElement> {
  const { postId } = await params;
  const account = await requireAccount(`/portal/posts/${postId}`);
  if (!(await isZodeAdmin(account))) notFound();
  const post = await getPost(postId);
  if (!post) notFound();

  return (
    <div className={styles.page}>
      <PostEditor key={post.id} post={post} />
    </div>
  );
}
