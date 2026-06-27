"use client";

import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import styles from "./ProductHero.module.css";

// The hero cycles through these clips, hard-cutting to the next every
// CLIP_DURATION_MS, then loops back to the first. Drop replacements for
// hero-2..hero-5 into public/videos/ to fill the remaining slots.
const CLIPS = [
  "/videos/hero-1.mp4",
  "/videos/hero-2.mp4",
  "/videos/hero-3.mp4",
  "/videos/hero-4.mp4",
  "/videos/hero-5.mp4",
];

const CLIP_DURATION_MS = 3000;

/**
 * Full-bleed hero for the Product page: a looping sequence of video clips with
 * a bottom gradient scrim and bottom-left intro copy. Sits inside the (site)
 * shell's normally-scrolling body panel.
 */
export function ProductHero(): ReactElement {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActive((index) => (index + 1) % CLIPS.length);
    }, CLIP_DURATION_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className={styles.hero} aria-label="Meet ZODE One">
      {CLIPS.map((src, index) => (
        <video
          key={src}
          className={`${styles.video} ${index === active ? styles.active : ""}`}
          src={src}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
        />
      ))}
      <div className={styles.scrim} aria-hidden="true" />
      <div className={styles.copy}>
        <h1 className={styles.title}>Meet ZODE One.</h1>
        <p className={styles.description}>
          The first rapidly deployable data center to respond to the AI energy
          crisis.
        </p>
      </div>
    </section>
  );
}
