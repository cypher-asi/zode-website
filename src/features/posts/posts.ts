import "server-only";
import { isUuid } from "@/features/data-room/rooms";
import { avatarUrl } from "@/features/account/profile";
import type { Account } from "@/features/account/zos";
import { db } from "@/lib/db";
import { siteApi, type ApiPost } from "./cypher";
import type { Post, PostDraft, PostKind, PostStatus } from "./types";

/*
 * Posts live on the Cypher content API, which serves every site's writing.
 * Bylines are filled in here, since names and photos belong to ZODE accounts.
 */

/** Cache tag of every cached read of published posts: the public pages and the sitemap. */
export const POSTS_TAG = "posts";

interface Byline {
  name: string | null;
  avatarPathname: string | null;
}

/**
 * Each author's name and photo as they are now: the name from portal settings,
 * else ZOS's as of their last sign-in. Only a settings photo can show, since
 * the CSP blocks ZOS's. Without the database, posts keep the saved names.
 */
async function bylines(userIds: string[]): Promise<Map<string, Byline>> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return new Map();
  try {
    const rows = await db()`
      select u.user_id,
        coalesce(nullif(ap.display_name, ''), nullif(ad.display_name, '')) as name,
        ap.avatar_pathname
      from unnest(${ids}::text[]) as u(user_id)
      left join account_profiles ap on ap.user_id = u.user_id
      left join account_directory ad on ad.user_id = u.user_id
    `;
    return new Map(
      rows.map((row) => [
        String(row.user_id),
        {
          name: row.name == null ? null : String(row.name),
          avatarPathname: row.avatar_pathname == null ? null : String(row.avatar_pathname),
        },
      ]),
    );
  } catch (error) {
    console.error("[posts] couldn't load bylines", error);
    return new Map();
  }
}

const toPost = (post: ApiPost, byline: Byline | undefined): Post => ({
  id: post.id,
  kind: post.kind as PostKind,
  status: post.status as PostStatus,
  slug: post.slug,
  title: post.title,
  summary: post.summary,
  bodyMd: post.bodyMd ?? "",
  version: post.version,
  coverPathname: post.coverPathname,
  author: {
    name: byline?.name ?? post.author.name,
    email: post.author.email,
    image: byline?.avatarPathname ? avatarUrl(post.author.userId, byline.avatarPathname) : null,
  },
  createdAt: new Date(post.createdAt),
  updatedAt: new Date(post.updatedAt),
  updatedByEmail: post.updatedByEmail,
  publishedAt: post.publishedAt == null ? null : new Date(post.publishedAt),
});

async function withBylines(posts: ApiPost[]): Promise<Post[]> {
  const found = await bylines(posts.map((post) => post.author.userId));
  return posts.map((post) => toPost(post, found.get(post.author.userId)));
}

async function withByline(post: ApiPost | undefined): Promise<Post | null> {
  return post ? (await withBylines([post]))[0] : null;
}

type PostResponse = { post: ApiPost };
type ListResponse = { posts: ApiPost[] };

/** Published posts of one kind, newest first. Lists leave out the body unless asked, since it can be long. */
export async function listPublished(kind: PostKind, { withBody = false } = {}): Promise<Post[]> {
  const res = await siteApi<ListResponse>("/posts", { query: { kind, withBody: withBody ? "1" : undefined } });
  return withBylines(res?.posts ?? []);
}

export async function getPublishedBySlug(kind: PostKind, slug: string): Promise<Post | null> {
  const res = await siteApi<PostResponse>(`/posts/slug/${kind}/${encodeURIComponent(slug)}`);
  return withByline(res?.post);
}

/** Every post, drafts included, most recently edited first. For the ZODE team only. */
export async function listAllPosts(): Promise<Post[]> {
  const res = await siteApi<ListResponse>("/posts", { query: { status: "all" } });
  const posts = await withBylines(res?.posts ?? []);
  return posts.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function getPost(id: string): Promise<Post | null> {
  if (!isUuid(id)) return null;
  const res = await siteApi<PostResponse>(`/posts/${id}`);
  return withByline(res?.post);
}

/** Whether the account wrote a published post, so its name or photo shows on the public pages. */
export async function hasPublishedPosts(userId: string): Promise<boolean> {
  const res = await siteApi<ListResponse>("/posts", { query: { author: userId } });
  return Boolean(res?.posts.length);
}

/** An empty draft by this account, with a placeholder slug that the first save replaces. */
export async function createDraft(kind: PostKind, account: Account): Promise<string> {
  const res = await siteApi<PostResponse>("/posts", {
    method: "POST",
    body: { kind, author: { userId: account.userId, name: account.displayName, email: account.email } },
  });
  if (!res) throw new Error("The Cypher API doesn't know this site.");
  return res.post.id;
}

/**
 * Saves the editor's fields, then publishes the post when `publish` is set.
 * Throws a `CypherError` with code `slug_taken` or `validation` when the API
 * refuses the draft; its message is meant for the editor.
 */
export async function updatePost(
  id: string,
  draft: PostDraft,
  editorEmail: string,
  { publish = false } = {},
): Promise<Post | null> {
  if (!isUuid(id)) return null;
  const res = await siteApi<PostResponse>(`/posts/${id}`, {
    method: "PATCH",
    body: { draft, publish, editorEmail },
  });
  return withByline(res?.post);
}

export async function setStatus(id: string, status: PostStatus, editorEmail: string): Promise<Post | null> {
  if (!isUuid(id)) return null;
  const res = await siteApi<PostResponse>(`/posts/${id}/status`, { method: "POST", body: { status, editorEmail } });
  return withByline(res?.post);
}

/** Deletes the post; the API removes its images once it has answered. */
export async function deletePost(id: string): Promise<Post | null> {
  if (!isUuid(id)) return null;
  const res = await siteApi<PostResponse>(`/posts/${id}`, { method: "DELETE" });
  return withByline(res?.post);
}
