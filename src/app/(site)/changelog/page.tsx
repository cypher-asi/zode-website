import type { Metadata } from "next";
import type { ReactElement } from "react";
import { ChangelogList, IndexHeader } from "@/features/posts/PostArticle";
import { loadPublished } from "@/features/posts/pages";
import styles from "@/features/posts/Posts.module.css";

export const metadata: Metadata = {
  title: "Changelog | ZODE",
  description: "New features, improvements and fixes across ZODE.",
};

/** Publishing refreshes this page straight away; the hour is a backstop. */
export const revalidate = 3600;

export default async function ChangelogPage(): Promise<ReactElement> {
  const posts = await loadPublished("changelog", true);

  return (
    <div className={styles.page} data-wide="">
      <IndexHeader eyebrow="CHANGELOG" title="Changelog" subtitle="New features, improvements and fixes across ZODE." />
      {posts === null ? (
        <p className={styles.empty}>The changelog couldn&apos;t be loaded right now. Please try again shortly.</p>
      ) : posts.length ? (
        <ChangelogList posts={posts} />
      ) : (
        <p className={styles.empty}>Nothing here yet. Check back soon.</p>
      )}
    </div>
  );
}
