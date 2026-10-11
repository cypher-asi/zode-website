import type { CSSProperties, ReactElement } from "react";
import styles from "./TypedLine.module.css";

/**
 * A line of prose typed in from first paint behind a block cursor, like the
 * hero menu beside it. The text face isn't monospaced, so rather than growing
 * a width in `ch` steps each character appears in turn, which also holds up
 * when the line wraps. Pure CSS, so it runs before hydration.
 */
export function TypedLine({
  text,
  className,
}: {
  text: string;
  className?: string;
}): ReactElement {
  let n = 0;
  const char = (value: string) => (
    <span key={n} className={styles.char} style={{ "--n": n++ } as CSSProperties}>
      {value}
    </span>
  );

  return (
    <p className={className ? `${styles.line} ${className}` : styles.line}>
      <span className={styles.srOnly}>{text}</span>
      <span aria-hidden="true">
        {text.split(" ").flatMap((word, i) => [
          i > 0 ? char(" ") : null,
          <span key={`w${i}`} className={styles.word}>
            {Array.from(word, char)}
          </span>,
        ])}
      </span>
    </p>
  );
}
