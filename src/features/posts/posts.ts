import "server-only";
import { randomBytes } from "node:crypto";
import { isUuid } from "@/features/data-room/rooms";
import type { Account } from "@/features/account/zos";
import { db } from "@/lib/db";
import type { Post, PostDraft, PostKind, PostStatus } from "./types";

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
  author: { name: String(row.author_name), email: String(row.author_email) },
  createdAt: new Date(row.created_at as string | Date),
  updatedAt: new Date(row.updated_at as string | Date),
  updatedByEmail: row.updated_by_email == null ? null : String(row.updated_by_email),
  publishedAt: row.published_at == null ? null : new Date(row.published_at as string | Date),
});

/** Published posts of one kind, newest first. Lists leave out the body unless asked, since it can be long. */
export async function listPublished(kind: PostKind, { withBody = false } = {}): Promise<Post[]> {
  const rows = withBody
    ? await db()`
        select * from posts where kind = ${kind} and status = 'published' order by published_at desc
      `
    : await db()`
        select id, kind, status, slug, title, summary, '' as body_md, version, cover_pathname,
          author_name, author_email, created_at, updated_at, updated_by_email, published_at
        from posts where kind = ${kind} and status = 'published' order by published_at desc
      `;
  return rows.map(toPost);
}

export async function getPublishedBySlug(kind: PostKind, slug: string): Promise<Post | null> {
  const [row] = await db()`select * from posts where kind = ${kind} and slug = ${slug} and status = 'published'`;
  return row ? toPost(row) : null;
}

/** Every post, drafts included, most recently edited first. For the ZODE team only. */
export async function listAllPosts(): Promise<Post[]> {
  const rows = await db()`
    select id, kind, status, slug, title, summary, '' as body_md, version, cover_pathname,
      author_name, author_email, created_at, updated_at, updated_by_email, published_at
    from posts order by updated_at desc
  `;
  return rows.map(toPost);
}

export async function getPost(id: string): Promise<Post | null> {
  if (!isUuid(id)) return null;
  const [row] = await db()`select * from posts where id = ${id}`;
  return row ? toPost(row) : null;
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

const WORDS_PER_MINUTE = 230;

export function readingMinutes(markdown: string): number {
  const words = markdown.replace(/[#>*_`~[\]()!-]/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
