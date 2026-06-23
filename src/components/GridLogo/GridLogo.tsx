import type { ReactElement } from "react";
import styles from "./GridLogo.module.css";

const ELLIPSE_COUNT = 22;
const MAX_ROTATION_DEG = 30;

/**
 * Inline-SVG recreation of THE GRID loop mark: a band of wide ellipses
 * rotated through a small angle range, producing the horizontal torus
 * with a crossing "X" pinch at the centre. Drawn with `currentColor`
 * so it inverts with the active theme. Paired with the wordmark.
 */
export function GridLogo({ showWordmark = true }: { showWordmark?: boolean }): ReactElement {
  const ellipses = Array.from({ length: ELLIPSE_COUNT }, (_, index) => {
    const t = index / (ELLIPSE_COUNT - 1);
    const angle = -MAX_ROTATION_DEG + t * (MAX_ROTATION_DEG * 2);
    return angle;
  });

  return (
    <span className={styles.logo} aria-label="THE GRID">
      <svg
        className={styles.glyph}
        viewBox="0 0 140 60"
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        <g transform="translate(70 30)">
          {ellipses.map((angle) => (
            <ellipse
              key={angle}
              rx="62"
              ry="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.6"
              transform={`rotate(${angle})`}
            />
          ))}
        </g>
      </svg>
      {showWordmark ? <span className={styles.wordmark}>THE GRID</span> : null}
    </span>
  );
}
