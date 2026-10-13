import "server-only";
import type { Metadata } from "next";
import { cache, type ReactElement } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { SubscribeForm } from "@/features/mailing-list/SubscribeForm";
import { DB_TAG } from "@/lib/db";
import { PostArticle } from "./PostArticle";
import { POSTS_TAG, getPublishedBySlug, listPublished } from "./posts";
import { kindLabel, mediaUrl, postHref, type Post, type PostKind } from "./types";
import styles from "./Posts.module.css";

/*
 * Published posts are cached on the server for an hour under POSTS_TAG, which
 * publishing and editing expire. Failures throw inside the cache, so they're
 * never cached, and turn into `null` outside it.
 */

async function publishedPosts(kind: PostKind, withBody: boolean): Promise<Post[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(POSTS_TAG, DB_TAG);
  return listPublished(kind, { withBody });
}

async function publishedPost(kind: PostKind, slug: string): Promise<Post | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(POSTS_TAG, DB_TAG);
  return getPublishedBySlug(kind, slug);
}

/** Published posts of a kind, or `null` when the database couldn't be reached. */
export function loadPublished(kind: PostKind, withBody = false): Promise<Post[] | null> {
  return publishedPosts(kind, withBody).catch((error: unknown) => {
    console.error(`[posts] failed to load ${kind}`, error);
    return null;
  });
}

/** Shared by a post page and its metadata within one render. */
const loadPost = cache(
  (kind: PostKind, slug: string): Promise<Post | null> =>
    publishedPost(kind, slug).catch((error: unknown) => {
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
      <PostArticle post={post} footer={<SubscribeForm list={post.kind} source="post" />} />
    </div>
  );
}
