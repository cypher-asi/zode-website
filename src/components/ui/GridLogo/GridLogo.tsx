import type { ReactElement } from "react";
import styles from "./GridLogo.module.css";

interface GridLogoProps {
  readonly showWordmark?: boolean;
  /** "bar" is the compact top-bar mark; "cover" is the large centered mark. */
  readonly size?: "bar" | "cover";
}

/**
 * THE GRID loop mark. A single transparent PNG (white lines, alpha from the
 * source) that blends on any dark surface and is inverted to black via CSS for
 * the light theme. Optionally paired with the wordmark.
 */
export function GridLogo({
  showWordmark = true,
  size = "bar",
}: GridLogoProps): ReactElement {
  const glyphClass =
    size === "cover" ? `${styles.glyph} ${styles.glyphCover}` : styles.glyph;

  return (
    <span className={styles.logo} aria-label="ZODE">
      {/* Small static decorative mark sized responsively via CSS and recolored
          with a CSS filter; next/image's fixed-dimension model adds no value. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={glyphClass} src="/logo.png" alt="" aria-hidden="true" />
      {showWordmark ? <span className={styles.wordmark}>ZODE</span> : null}
    </span>
  );
}
