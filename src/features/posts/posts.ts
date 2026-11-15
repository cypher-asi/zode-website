import "server-only";
import { randomBytes } from "node:crypto";
import { isUuid } from "@/features/data-room/rooms";
import { avatarUrl } from "@/features/account/profile";
import type { Account } from "@/features/account/zos";
import { db } from "@/lib/db";
import type { Author, Post, PostDraft, PostKind, PostStatus } from "./types";

/** Cache tag of every cached read of published posts: the public pages and the sitemap. */
export const POSTS_TAG = "posts";

/**
 * `posts` with each author's name and photo as they are now: the name from
 * portal settings, else ZOS's as of their last sign-in, else the one saved
 * with the post. Only a settings photo can show, since the CSP blocks ZOS's.
 */
const postsWithAuthor = (sql: ReturnType<typeof db>) => sql`(
  select p.*,
    coalesce(nullif(ap.display_name, ''), nullif(ad.display_name, ''), p.author_name) as current_author_name,
    ap.avatar_pathname as author_avatar_pathname
  from posts p
  left join account_profiles ap on ap.user_id = p.author_user_id
  left join account_directory ad on ad.user_id = p.author_user_id
) posts`;

/** Rows from `postsWithAuthor` carry the current name and photo; a bare `returning *` falls back to the saved name. */
const toAuthor = (row: Record<string, unknown>): Author => ({
  name: String(row.current_author_name ?? row.author_name),
  email: String(row.author_email),
  image: row.author_avatar_pathname
    ? avatarUrl(String(row.author_user_id), String(row.author_avatar_pathname))
    : null,
});

const toPost = (row: Record<string, unknown>): Post => ({
  id: String(row.id),
  kind: row.kind as PostKind,
  status: row.status as PostStatus,
  slug: String(row.slug),
  title: String(row.title),
  summary: String(row.summary),
  bodyMd: String(row.body_md ?? ""),
  version: row.version == null ? null : String(row.version),
  coverPathname: row.cover_pathname == null ? null : String(row.cover_pathname),
  author: toAuthor(row),
  createdAt: new Date(row.created_at as string | Date),
  updatedAt: new Date(row.updated_at as string | Date),
  updatedByEmail: row.updated_by_email == null ? null : String(row.updated_by_email),
  publishedAt: row.published_at == null ? null : new Date(row.published_at as string | Date),
});

/** Published posts of one kind, newest first. Lists leave out the body unless asked, since it can be long. */
export async function listPublished(kind: PostKind, { withBody = false } = {}): Promise<Post[]> {
  const sql = db();
  const rows = withBody
    ? await sql`
        select * from ${postsWithAuthor(sql)} where kind = ${kind} and status = 'published' order by published_at desc
      `
    : await sql`
        select id, kind, status, slug, title, summary, '' as body_md, version, cover_pathname,
          author_user_id, author_name, author_email, current_author_name, author_avatar_pathname,
          created_at, updated_at, updated_by_email, published_at
        from ${postsWithAuthor(sql)} where kind = ${kind} and status = 'published' order by published_at desc
      `;
  return rows.map(toPost);
}

export async function getPublishedBySlug(kind: PostKind, slug: string): Promise<Post | null> {
  const sql = db();
  const [row] = await sql`
    select * from ${postsWithAuthor(sql)} where kind = ${kind} and slug = ${slug} and status = 'published'
  `;
  return row ? toPost(row) : null;
}

/** Every post, drafts included, most recently edited first. For the ZODE team only. */
export async function listAllPosts(): Promise<Post[]> {
  const sql = db();
  const rows = await sql`
    select id, kind, status, slug, title, summary, '' as body_md, version, cover_pathname,
      author_user_id, author_name, author_email, current_author_name, author_avatar_pathname,
      created_at, updated_at, updated_by_email, published_at
    from ${postsWithAuthor(sql)} order by updated_at desc
  `;
  return rows.map(toPost);
}

export async function getPost(id: string): Promise<Post | null> {
  if (!isUuid(id)) return null;
  const sql = db();
  const [row] = await sql`select * from ${postsWithAuthor(sql)} where id = ${id}`;
  return row ? toPost(row) : null;
}

/** Whether the account wrote a published post, so its name or photo shows on the public pages. */
export async function hasPublishedPosts(userId: string): Promise<boolean> {
  const [row] = await db()`select 1 from posts where author_user_id = ${userId} and status = 'published' limit 1`;
  return Boolean(row);
}

/** An empty draft by this account, with a placeholder slug that the first save replaces. */
export async function createDraft(kind: PostKind, account: Account): Promise<string> {
  const slug = `untitled-${randomBytes(4).toString("hex")}`;
  const [row] = await db()`
    insert into posts (kind, slug, author_user_id, author_name, author_email, updated_by_email)
    values (${kind}, ${slug}, ${account.userId}, ${account.displayName}, ${account.email}, ${account.email})
    returning id
  `;
  return String(row.id);
}

export async function slugTaken(kind: PostKind, slug: string, exceptId: string): Promise<boolean> {
  const [row] = await db()`select 1 from posts where kind = ${kind} and slug = ${slug} and id <> ${exceptId}`;
  return Boolean(row);
}

export async function updatePost(id: string, draft: PostDraft, editorEmail: string): Promise<Post | null> {
  const [row] = await db()`
    update posts set
      kind = ${draft.kind},
      slug = ${draft.slug},
      title = ${draft.title},
      summary = ${draft.summary},
      body_md = ${draft.bodyMd},
      version = ${draft.kind === "changelog" && draft.version ? draft.version : null},
      cover_pathname = ${draft.coverPathname},
      updated_at = now(),
      updated_by_email = ${editorEmail}
    where id = ${id}
    returning *
  `;
  return row ? toPost(row) : null;
}

export async function setStatus(id: string, status: PostStatus, editorEmail: string): Promise<Post | null> {
  const [row] = await db()`
    update posts set
      status = ${status},
      published_at = case when ${status}::text = 'published' then coalesce(published_at, now()) else published_at end,
      updated_at = now(),
      updated_by_email = ${editorEmail}
    where id = ${id}
    returning *
  `;
  return row ? toPost(row) : null;
}

export async function deletePost(id: string): Promise<Post | null> {
  const [row] = await db()`delete from posts where id = ${id} returning *`;
  return row ? toPost(row) : null;
}
