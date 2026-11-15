import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import { PostBody } from "./PostBody";
import { Byline, PostMeta, postDate, shownDate } from "./PostMeta";
import { mediaUrl, postHref, readingMinutes, type Post } from "./types";
import styles from "./Posts.module.css";

/** One post in full: date and kind, title, byline, cover and body, in the narrow column of cursor.com/blog. */
export function PostArticle({
  post,
  banner,
  footer,
}: {
  post: Post;
  banner?: ReactNode;
  footer?: ReactNode;
}): ReactElement {
  return (
    <article className={styles.article}>
      {banner}
      <header className={styles.articleHeader}>
        <PostMeta date={shownDate(post)} kind={post.kind} version={post.version} />
        <h1 className={styles.articleTitle}>{post.title || "Untitled"}</h1>
        <Byline author={post.author} minutes={readingMinutes(post.bodyMd)} />
      </header>
      {post.coverPathname ? (
        // eslint-disable-next-line @next/next/no-img-element -- uploads are served at their own size from /post-media
        <img className={styles.cover} src={mediaUrl(post.coverPathname)} alt="" />
      ) : null}
      <PostBody markdown={post.bodyMd} />
      {footer}
      <p className={styles.back}>
        <Link className={styles.backLink} href={`/${post.kind}`}>
          ← All {post.kind === "news" ? "news" : "changelog entries"}
        </Link>
      </p>
    </article>
  );
}

/** The news index: newest first, each with its date, title, summary and author. */
export function NewsList({ posts }: { posts: Post[] }): ReactElement {
  return (
    <ul className={styles.index}>
      {posts.map((post) => (
        <li key={post.id}>
          <Link className={styles.entry} href={postHref(post.kind, post.slug)}>
            <time className={styles.entryDate} dateTime={shownDate(post).toISOString()}>
              {postDate.format(shownDate(post))}
            </time>
            <span className={styles.entryMain}>
              <span className={styles.entryTitle}>{post.title}</span>
              {post.summary ? <span className={styles.entrySummary}>{post.summary}</span> : null}
              <span className={styles.entryAuthor}>{post.author.name}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The changelog: every entry in full, newest first, with its version and date in the margin. */
export function ChangelogList({ posts }: { posts: Post[] }): ReactElement {
  return (
    <ol className={styles.changelog}>
      {posts.map((post) => (
        <li key={post.id} className={styles.release}>
          <div className={styles.releaseAside}>
            {post.version ? <span className={styles.releaseVersion}>v{post.version}</span> : null}
            <time dateTime={shownDate(post).toISOString()}>{postDate.format(shownDate(post))}</time>
          </div>
          <div className={styles.releaseMain}>
            <h2 className={styles.releaseTitle}>
              <Link href={postHref(post.kind, post.slug)}>{post.title}</Link>
            </h2>
            <Byline author={post.author} />
            <PostBody markdown={post.bodyMd} />
          </div>
        </li>
      ))}
    </ol>
  );
}

export function IndexHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <header className={styles.hero}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1 className={styles.heading}>{title}</h1>
      <p className={styles.subtitle}>{subtitle}</p>
    </header>
  );
}
