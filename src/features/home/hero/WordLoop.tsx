"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import styles from "./WordLoop.module.css";

const ROTATE_MS = 2200;

const WORDS = ["Sovereign", "Distributed", "Sustainable", "Private"] as const;

/**
 * Vertical ticker that cycles the value props one word at a time: the
 * outgoing word slides up and out while the next slides in from below.
 * The animated words are hidden from assistive tech in favour of a static
 * list so screen readers don't announce every tick. Ticking pauses while the
 * loop is off screen or the tab is hidden.
 */
export function WordLoop(): ReactElement {
  const ref = useRef<HTMLSpanElement>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let timer = 0;
    let visible = false;
    const sync = () => {
      const run = visible && !document.hidden;
      if (run && !timer) {
        timer = window.setInterval(() => setTick((value) => value + 1), ROTATE_MS);
      } else if (!run && timer) {
        window.clearInterval(timer);
        timer = 0;
      }
    };

    const io = new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      sync();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", sync);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
      window.clearInterval(timer);
    };
  }, []);

  const index = tick % WORDS.length;
  const prevIndex = (tick - 1 + WORDS.length) % WORDS.length;

  return (
    <span ref={ref} className={styles.loop}>
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
