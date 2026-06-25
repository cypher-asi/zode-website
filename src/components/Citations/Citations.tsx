import type { ReactElement } from "react";
import type { Citation } from "@/content/sections";
import styles from "./Citations.module.css";

/**
 * Renders a section's source citations as a small footnote-style list of
 * external links. Returns null when there are no citations so callers can
 * drop it into any layout unconditionally.
 */
export function Citations({
  items,
}: {
  readonly items?: readonly Citation[];
}): ReactElement | null {
  if (!items || items.length === 0) return null;

  return (
    <aside className={styles.citations} aria-label="Sources">
      <ol className={styles.list}>
        {items.map((citation, index) => (
          <li key={citation.href} className={styles.item}>
            <span className={styles.marker} aria-hidden="true">
              {String.fromCharCode(97 + index)}.
            </span>
            <a
              className={styles.link}
              href={citation.href}
              target="_blank"
              rel="noreferrer noopener"
            >
              {citation.label}
            </a>
          </li>
        ))}
      </ol>
    </aside>
  );
}
