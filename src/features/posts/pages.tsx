import "server-only";
import type { Metadata } from "next";
import { cache, type ReactElement } from "react";
import { notFound } from "next/navigation";
import { PostArticle } from "./PostArticle";
import { getPublishedBySlug, listPublished } from "./posts";
import { kindLabel, mediaUrl, postHref, type Post, type PostKind } from "./types";
import styles from "./Posts.module.css";

/** Published posts of a kind, or `null` when the database couldn't be reached. */
export function loadPublished(kind: PostKind, withBody = false): Promise<Post[] | null> {
  return listPublished(kind, { withBody }).catch((error: unknown) => {
    console.error(`[posts] failed to load ${kind}`, error);
    return null;
  });
}

/** Shared by a post page and its metadata within one render. */
const loadPost = cache(
  (kind: PostKind, slug: string): Promise<Post | null> =>
    getPublishedBySlug(kind, slug).catch((error: unknown) => {
      console.error(`[posts] failed to load ${kind}/${slug}`, error);
      return null;
    }),
);

export async function postMetadata(kind: PostKind, slug: string): Promise<Metadata> {
  const post = await loadPost(kind, slug);
  if (!post) return { title: `${kindLabel(kind)} | ZODE` };
  return {
    title: `${post.title} | ${kindLabel(kind)} | ZODE`,
    description: post.summary || undefined,
    alternates: { canonical: postHref(kind, slug) },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.summary || undefined,
      publishedTime: post.publishedAt?.toISOString(),
      authors: [post.author.name],
      images: post.coverPathname ? [mediaUrl(post.coverPathname)] : undefined,
    },
  };
}

export async function PublishedPostPage({ kind, slug }: { kind: PostKind; slug: string }): Promise<ReactElement> {
  const post = await loadPost(kind, slug);
  if (!post) notFound();
  return (
    <div className={styles.page}>
      <PostArticle post={post} />
    </div>
  );
}
