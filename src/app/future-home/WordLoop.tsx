"use client";

import { useEffect, useState, type ReactElement } from "react";
import styles from "./WordLoop.module.css";

const ROTATE_MS = 2200;

const WORDS = ["Sovereign", "Distributed", "Sustainable", "Private"] as const;

/**
 * Vertical ticker that cycles the value props one word at a time: the
 * outgoing word slides up and out while the next slides in from below.
 * The animated words are hidden from assistive tech in favour of a static
 * list so screen readers don't announce every tick.
 */
export function WordLoop(): ReactElement {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((value) => value + 1), ROTATE_MS);
    return () => clearInterval(id);
  }, []);

  const index = tick % WORDS.length;
  const prevIndex = (tick - 1 + WORDS.length) % WORDS.length;

  return (
    <span className={styles.loop}>
      <span className={styles.srOnly}>{WORDS.join(", ")}</span>
      <span className={styles.track} aria-hidden="true">
        {tick > 0 ? (
          <span key={`out-${tick}`} className={styles.wordLeaving}>
            {WORDS[prevIndex]}
          </span>
        ) : null}
        <span key={`in-${tick}`} className={styles.wordEntering}>
          {WORDS[index]}
        </span>
      </span>
    </span>
  );
}
