import type { ReactElement } from "react";
import styles from "./PortalLoading.module.css";

const ROWS = 3;

/** Placeholder for a portal section while its data loads; `header={false}` for inside a data room, which keeps its own bar. */
export function PortalLoading({ header = true }: { header?: boolean }): ReactElement {
  return (
    <div className={styles.page} role="status" aria-label="Loading">
      {header ? (
        <div className={styles.header}>
          <span className={styles.title} />
          <span className={styles.subtitle} />
        </div>
      ) : null}
      <div className={styles.list}>
        {Array.from({ length: ROWS }, (_, index) => (
          <div key={index} className={styles.row}>
            <span className={styles.icon} />
            <span className={styles.lines}>
              <span className={styles.line} />
              <span className={styles.meta} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
