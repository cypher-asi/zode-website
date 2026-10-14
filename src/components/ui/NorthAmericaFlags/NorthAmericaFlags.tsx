import type { ReactElement } from "react";
import styles from "./NorthAmericaFlags.module.css";

interface NorthAmericaFlagsProps {
  readonly className?: string;
}

/**
 * The United States and Canada flags as outline drawings. Stroked in
 * `currentColor` and sized by `--flag-h`, so the caller sets both.
 */
export function NorthAmericaFlags({ className }: NorthAmericaFlagsProps): ReactElement {
  return (
    <div
      className={className ? `${styles.flags} ${className}` : styles.flags}
      role="img"
      aria-label="United States and Canada"
    >
      <svg className={styles.flag} viewBox="0 0 38 20" aria-hidden="true">
        <rect x="0" y="0" width="38" height="20" />
        <rect x="0" y="0" width="15.2" height="11.43" />
        <line x1="15.2" y1="2.86" x2="38" y2="2.86" />
        <line x1="15.2" y1="5.71" x2="38" y2="5.71" />
        <line x1="15.2" y1="8.57" x2="38" y2="8.57" />
        <line x1="15.2" y1="11.43" x2="38" y2="11.43" />
        <line x1="0" y1="14.29" x2="38" y2="14.29" />
        <line x1="0" y1="17.14" x2="38" y2="17.14" />
      </svg>
      <svg className={styles.flag} viewBox="0 0 40 20" aria-hidden="true">
        <rect x="0" y="0" width="40" height="20" />
        <line x1="10" y1="0" x2="10" y2="20" />
        <line x1="30" y1="0" x2="30" y2="20" />
        <path d="M20 3 L21.5 6 L23 5.2 L22.6 8.5 L25.5 7 L24.8 9.6 L26.5 10.2 L23.5 12.5 L24 14 L20.5 13.2 L20.5 17 L19.5 17 L19.5 13.2 L16 14 L16.5 12.5 L13.5 10.2 L15.2 9.6 L14.5 7 L17.4 8.5 L17 5.2 L18.5 6 Z" />
      </svg>
    </div>
  );
}
