"use client";

import { useEffect, useState, type ReactElement } from "react";
import styles from "./RotatingTagline.module.css";

const ROTATE_MS = 2500;

const TAGLINES = ["Decentralized.", "Secure.", "Private.", "Open Source."] as const;

/**
 * Decorative chrome text in the bottom taskbar that cycles the value
 * props one word at a time with a vertical ticker (outgoing word
 * slides up and out, incoming slides in from the bottom). Ported from
 * the aura-os public-mode taskbar. Purely presentational, so it is
 * marked `aria-hidden`.
 */
export function RotatingTagline(): ReactElement {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((value) => value + 1), ROTATE_MS);
    return () => clearInterval(id);
  }, []);

  const index = tick % TAGLINES.length;
  const prevIndex = (tick - 1 + TAGLINES.length) % TAGLINES.length;

  return (
    <span className={styles.tagline} aria-hidden="true">
      {tick > 0 ? (
        <span key={`out-${tick}`} className={styles.wordLeaving}>
          {TAGLINES[prevIndex]}
        </span>
      ) : null}
      <span key={`in-${tick}`} className={styles.wordEntering}>
        {TAGLINES[index]}
      </span>
    </span>
  );
}
