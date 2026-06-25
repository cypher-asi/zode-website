import type { ReactElement, ReactNode } from "react";
import styles from "./Card.module.css";

/**
 * Squared, borderless-fill card with a gray title and arbitrary content
 * (typically a `CardBulletList` or a chart). Used for the Product spec cards,
 * Traction site cards, and Investment panels.
 */
export function ListCard({
  title,
  className,
  children,
}: {
  title: string;
  /** Extra class applied to the card box (e.g. layout helpers). */
  className?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div className={className ? `${styles.list} ${className}` : styles.list}>
      <p className={styles.listTitle}>{title}</p>
      {children}
    </div>
  );
}
