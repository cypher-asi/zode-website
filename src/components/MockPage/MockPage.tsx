import type { ReactElement } from "react";
import styles from "./MockPage.module.css";

interface MockPageProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
}

/**
 * Placeholder content for routes that are not built out yet. Lives inside
 * the inner "screen" panel so it inherits the same theming as the deck.
 */
export function MockPage({ eyebrow, title, description }: MockPageProps): ReactElement {
  return (
    <section className={styles.page} aria-label={title}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
        <span className={styles.badge}>Coming soon</span>
      </div>
    </section>
  );
}
