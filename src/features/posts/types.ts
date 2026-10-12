export type PostKind = "news" | "changelog";
export type PostStatus = "draft" | "published";

export const POST_KINDS: readonly { id: PostKind; label: string; href: string }[] = [
  { id: "news", label: "News", href: "/news" },
  { id: "changelog", label: "Changelog", href: "/changelog" },
];

export const isPostKind = (value: unknown): value is PostKind => value === "news" || value === "changelog";

export const kindLabel = (kind: PostKind): string => (kind === "news" ? "News" : "Changelog");

/** The public URL of a post; drafts have none until published. */
export const postHref = (kind: PostKind, slug: string): string => `/${kind}/${slug}`;

export const MAX_TITLE_LENGTH = 160;
export const MAX_SUMMARY_LENGTH = 320;
export const MAX_SLUG_LENGTH = 96;
export const MAX_VERSION_LENGTH = 32;
export const MAX_BODY_LENGTH = 200_000;

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Lowercase words joined by hyphens, as used in post URLs. */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");
}

/** Where an uploaded post image is served from, given its Blob pathname. */
export const mediaUrl = (pathname: string): string => `/post-media/${pathname}`;

export const MEDIA_PREFIX = "posts/";

export interface Author {
  name: string;
  email: string;
}

export interface Post {
  id: string;
  kind: PostKind;
  status: PostStatus;
  slug: string;
  title: string;
  summary: string;
  bodyMd: string;
  version: string | null;
  coverPathname: string | null;
  author: Author;
  createdAt: Date;
  updatedAt: Date;
  updatedByEmail: string | null;
  publishedAt: Date | null;
}

/** What the editor sends to be saved. */
export interface PostDraft {
  kind: PostKind;
  slug: string;
  title: string;
  summary: string;
  bodyMd: string;
  version: string;
  coverPathname: string | null;
}

export interface SaveResult {
  readonly error?: string;
  readonly savedAt?: string;
  readonly status?: PostStatus;
}
