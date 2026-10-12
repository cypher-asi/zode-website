"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { isZodeAdmin } from "@/features/account/admin";
import { getAccount } from "@/features/account/session";
import type { Account } from "@/features/account/zos";
import { deletePostBlobs, postBlobPrefix } from "./blob";
import { createDraft, deletePost, getPost, setStatus, slugTaken, updatePost } from "./posts";
import {
  MAX_BODY_LENGTH,
  MAX_SLUG_LENGTH,
  MAX_SUMMARY_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_VERSION_LENGTH,
  SLUG_RE,
  isPostKind,
  postHref,
  type Post,
  type PostDraft,
  type SaveResult,
} from "./types";

const NO_ACCESS: SaveResult = { error: "You don't have permission to do that. Try reloading the page." };
const NOT_FOUND: SaveResult = { error: "This post no longer exists." };
const FAILED: SaveResult = { error: "Couldn't save right now. Please try again." };

async function adminAccount(): Promise<Account | null> {
  const account = await getAccount();
  return account && (await isZodeAdmin(account)) ? account : null;
}

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** Checks everything the editor sends; `publishing` also requires what a public post can't go without. */
function cleanDraft(postId: string, raw: PostDraft, publishing: boolean): PostDraft | { error: string } {
  if (!isPostKind(raw?.kind)) return { error: "Choose News or Changelog." };
  const title = text(raw.title);
  const summary = text(raw.summary);
  const slug = text(raw.slug).toLowerCase();
  const version = text(raw.version);
  const bodyMd = typeof raw.bodyMd === "string" ? raw.bodyMd : "";
  const coverPathname = typeof raw.coverPathname === "string" && raw.coverPathname ? raw.coverPathname : null;

  if (title.length > MAX_TITLE_LENGTH) return { error: "That title is too long." };
  if (summary.length > MAX_SUMMARY_LENGTH) return { error: "That summary is too long." };
  if (version.length > MAX_VERSION_LENGTH) return { error: "That version is too long." };
  if (bodyMd.length > MAX_BODY_LENGTH) return { error: "That post is too long." };
  if (!slug || slug.length > MAX_SLUG_LENGTH || !SLUG_RE.test(slug)) {
    return { error: "The URL slug can only use lowercase letters, numbers and single hyphens." };
  }
  if (coverPathname && (!coverPathname.startsWith(postBlobPrefix(postId)) || coverPathname.includes(".."))) {
    return { error: "That cover image doesn't belong to this post." };
  }
  if (publishing) {
    if (!title) return { error: "Add a title before publishing." };
    if (!bodyMd.trim()) return { error: "Write something before publishing." };
    if (slug.startsWith("untitled-")) return { error: "Give the post a URL slug before publishing." };
  }
  return { kind: raw.kind, title, summary, slug, version, bodyMd, coverPathname };
}

/** Refreshes the public pages a post appears on, before and after an edit that may move it. */
function revalidatePublic(...posts: (Post | null | undefined)[]): void {
  const seen = new Set<string>();
  for (const post of posts) {
    if (!post) continue;
    for (const path of [`/${post.kind}`, postHref(post.kind, post.slug)]) {
      if (seen.has(path)) continue;
      seen.add(path);
      revalidatePath(path);
    }
  }
  revalidatePath("/sitemap.xml");
}

async function save(postId: string, raw: PostDraft, publishing: boolean): Promise<SaveResult> {
  const account = await adminAccount();
  if (!account) return NO_ACCESS;
  const before = await getPost(postId);
  if (!before) return NOT_FOUND;

  const draft = cleanDraft(postId, raw, publishing);
  if ("error" in draft) return draft;

  try {
    if (await slugTaken(draft.kind, draft.slug, postId)) {
      return { error: `Another ${draft.kind === "news" ? "news post" : "changelog entry"} already uses that slug.` };
    }
    let post = await updatePost(postId, draft, account.email);
    if (post && publishing && post.status !== "published") post = await setStatus(postId, "published", account.email);
    if (!post) return NOT_FOUND;

    if (before.status === "published" || post.status === "published") revalidatePublic(before, post);
    return { savedAt: post.updatedAt.toISOString(), status: post.status };
  } catch (error) {
    console.error("[posts] save failed", error);
    return FAILED;
  }
}

export async function createPostAction(formData: FormData): Promise<void> {
  const account = await adminAccount();
  if (!account) redirect("/portal");
  const kind = formData.get("kind");
  const id = await createDraft(isPostKind(kind) ? kind : "news", account);
  redirect(`/portal/posts/${id}`);
}

/** Saves the editor's fields. A published post's edits go live straight away. */
export async function savePostAction(postId: string, draft: PostDraft): Promise<SaveResult> {
  return save(postId, draft, false);
}

export async function publishPostAction(postId: string, draft: PostDraft): Promise<SaveResult> {
  return save(postId, draft, true);
}

export async function unpublishPostAction(postId: string): Promise<SaveResult> {
  const account = await adminAccount();
  if (!account) return NO_ACCESS;
  try {
    const post = await setStatus(postId, "draft", account.email);
    if (!post) return NOT_FOUND;
    revalidatePublic(post);
    return { savedAt: post.updatedAt.toISOString(), status: post.status };
  } catch (error) {
    console.error("[posts] unpublish failed", error);
    return FAILED;
  }
}

export async function deletePostAction(postId: string): Promise<SaveResult> {
  const account = await adminAccount();
  if (!account) return NO_ACCESS;
  let post: Post | null;
  try {
    post = await deletePost(postId);
  } catch (error) {
    console.error("[posts] delete failed", error);
    return { error: "Couldn't delete right now. Please try again." };
  }
  if (!post) return NOT_FOUND;
  if (post.status === "published") revalidatePublic(post);
  after(() =>
    deletePostBlobs(postId).catch((error: unknown) => console.error("[posts] couldn't delete images", postId, error)),
  );
  redirect("/portal/posts");
}
