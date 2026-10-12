import type { Metadata } from "next";
import type { ReactElement } from "react";
import { IndexHeader, NewsList } from "@/features/posts/PostArticle";
import { loadPublished } from "@/features/posts/pages";
import styles from "@/features/posts/Posts.module.css";

export const metadata: Metadata = {
  title: "News | ZODE",
  description: "Announcements and updates from the ZODE team.",
};

/** Publishing refreshes this page straight away; the hour is a backstop. */
export const revalidate = 3600;

export default async function NewsPage(): Promise<ReactElement> {
  const posts = await loadPublished("news");

  return (
    <div className={styles.page}>
      <IndexHeader eyebrow="NEWS" title="News" subtitle="Announcements and updates from the ZODE team." />
      {posts === null ? (
        <p className={styles.empty}>News couldn&apos;t be loaded right now. Please try again shortly.</p>
      ) : posts.length ? (
        <NewsList posts={posts} />
      ) : (
        <p className={styles.empty}>Nothing here yet. Check back soon.</p>
      )}
    </div>
  );
}
