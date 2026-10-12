import type { Metadata } from "next";
import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { isZodeAdmin } from "@/features/account/admin";
import { requireAccount } from "@/features/account/session";
import { PostArticle } from "@/features/posts/PostArticle";
import { getPost } from "@/features/posts/posts";
import portal from "@/features/portal/portal.module.css";
import styles from "@/features/posts/Posts.module.css";

export const metadata: Metadata = {
  title: "Preview | ZODE",
  robots: { index: false, follow: false },
};

/** A post as it reads on the site, drafts included, as of its last save. ZODE admins only. */
export default async function PreviewPostPage({
  params,
}: PageProps<"/portal/posts/[postId]/preview">): Promise<ReactElement> {
  const { postId } = await params;
  const account = await requireAccount(`/portal/posts/${postId}/preview`);
  if (!isZodeAdmin(account)) notFound();
  const post = await getPost(postId);
  if (!post) notFound();

  return (
    <div className={portal.page}>
      <div className={styles.page} data-preview="">
        <PostArticle
          post={post}
          banner={
            <p className={styles.banner}>
              {post.status === "published"
                ? "Preview of the last saved version. This post is live."
                : "Draft preview. Only ZODE admins can see this until it's published."}
            </p>
          }
        />
      </div>
    </div>
  );
}
