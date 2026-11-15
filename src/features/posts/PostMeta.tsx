import type { ReactElement } from "react";
import Link from "next/link";
import { initials } from "@/features/account/initials";
import { kindLabel, type Author, type Post, type PostKind } from "./types";
import styles from "./Posts.module.css";

/*
 * The header lines of a post, shared by the article on the site and the
 * editor in the portal, so a post reads the same in both.
 */

export const postDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

/** When a post went out, or for a draft, when it was last edited. */
export const shownDate = (post: Pick<Post, "publishedAt" | "updatedAt">): Date => post.publishedAt ?? post.updatedAt;

/** Date, section and version, above the title. The editor passes `linked={false}` so the section can't navigate away. */
export function PostMeta({
  date,
  kind,
  version,
  linked = true,
}: {
  date: Date;
  kind: PostKind;
  version?: string | null;
  linked?: boolean;
}): ReactElement {
  return (
    <p className={styles.meta}>
      <time dateTime={date.toISOString()}>{postDate.format(date)}</time>
      <span aria-hidden="true">·</span>
      {linked ? (
        <Link className={styles.metaLink} href={`/${kind}`}>
          {kindLabel(kind)}
        </Link>
      ) : (
        <span>{kindLabel(kind)}</span>
      )}
      {version ? (
        <>
          <span aria-hidden="true">·</span>
          <span className={styles.version}>v{version}</span>
        </>
      ) : null}
    </p>
  );
}

export function Byline({ author, minutes }: { author: Author; minutes?: number }): ReactElement {
  return (
    <p className={styles.byline}>
      <span className={styles.avatar} aria-hidden="true">
        {author.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- served at its own size from /api/account/avatar
          <img src={author.image} alt="" />
        ) : (
          initials(author.name)
        )}
      </span>
      <span>
        {author.name}
        {minutes ? <> · {minutes} min read</> : null}
      </span>
    </p>
  );
}
