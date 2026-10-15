import type { ReactElement } from "react";
import { PostsHeader } from "@/features/posts/PostsIndex";
import styles from "@/features/portal/portal.module.css";

/** The Posts header over its All, News and Changelog tabs; a post's editor has its own. */
export default function PostsLayout({ children }: LayoutProps<"/portal/posts">): ReactElement {
  return (
    <div className={styles.page}>
      <PostsHeader />
      {children}
    </div>
  );
}
