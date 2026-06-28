"use client";

import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import styles from "./NetworkHero.module.css";

const TITLE = "Enter THE GRID";

/** Per-character cadence of the title typewriter reveal. */
const TYPE_SPEED_MS = 65;

/**
 * Full-bleed hero for the Network page: a single still backdrop with a bottom
 * gradient scrim and bottom-left intro copy. Mirrors the Product page's hero
 * reveal (fade-in + typed title) but swaps the cycling clips for one image.
 */
export function NetworkHero(): ReactElement {
  const [ready, setReady] = useState(false);
  const [typedCount, setTypedCount] = useState(0);

  // Reveal the hero as soon as the image can paint, but never block on it: a
  // fallback timer guarantees the intro runs even if `load` is missed or has
  // already fired before mount (e.g. a cached image).
  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 1200);
    return () => window.clearTimeout(id);
  }, []);

  // Once the hero has revealed, type the title out one character at a time.
  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => {
      setTypedCount((count) => {
        if (count >= TITLE.length) {
          window.clearInterval(id);
          return count;
        }
        return count + 1;
      });
    }, TYPE_SPEED_MS);
    return () => window.clearInterval(id);
  }, [ready]);

  // Nothing renders until the hero is ready (keeps SSR/hydration output empty).
  const shown = ready ? typedCount : 0;
  const typingDone = shown >= TITLE.length;

  return (
    <section
      className={`${styles.hero} ${ready ? styles.ready : ""}`}
      aria-label={TITLE}
    >
      <img
        className={styles.image}
        src="/images/network-hero.png"
        alt=""
        aria-hidden="true"
        onLoad={() => setReady(true)}
      />
      <div
        className={`${styles.scrim} ${typingDone ? styles.revealed : ""}`}
        aria-hidden="true"
      />
      <div className={styles.copy}>
        <h1 className={styles.title} aria-label={TITLE}>
          <span aria-hidden="true">{TITLE.slice(0, shown)}</span>
          {ready && !typingDone ? (
            <span className={styles.caret} aria-hidden="true" />
          ) : null}
        </h1>
        <p
          className={`${styles.description} ${typingDone ? styles.revealed : ""}`}
        >
          A distributed grid of rapidly deployable compute, connected into one
          network.
        </p>
      </div>
    </section>
  );
}
