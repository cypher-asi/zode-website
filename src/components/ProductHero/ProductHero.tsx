"use client";

import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import styles from "./ProductHero.module.css";

// The hero cycles through these clips, hard-cutting to the next every
// CLIP_DURATION_MS, then loops back to the first. To swap a clip, drop the
// file into public/videos/ and update the matching entry below.
const CLIPS = [
  "/videos/hero-1.mp4",
  "/videos/magnific_have-camera-panning-from-sky-looking-down-over-lan_seedance_4K_4-3_24fps_11052.mp4",
  "/videos/magnific_start-further-out-and-very-slowly-zoom-in-on-build_seedance_4K_4-3_24fps_11050.mp4",
  "/videos/magnific_have-camera-panning-from-sky-looking-down-over-lan_seedance_4K_4-3_24fps_67532.mp4",
  "/videos/magnific_have-camera-panning-left-to-right-over-scene-slowl_seedance_4K_4-3_24fps_53330.mp4",
];

const CLIP_DURATION_MS = 2500;

const TITLE = "Meet ZODE One.";

/** Per-character cadence of the title typewriter reveal. */
const TYPE_SPEED_MS = 65;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/**
 * Full-bleed hero for the Product page: a looping sequence of video clips with
 * a bottom gradient scrim and bottom-left intro copy. Sits inside the (site)
 * shell's normally-scrolling body panel.
 */
export function ProductHero(): ReactElement {
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(false);
  const [typedCount, setTypedCount] = useState(0);
  const [reduced] = useState(prefersReducedMotion);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActive((index) => (index + 1) % CLIPS.length);
    }, CLIP_DURATION_MS);
    return () => window.clearInterval(id);
  }, []);

  // Reveal the hero as soon as the first clip can play, but never block on it:
  // a fallback timer guarantees the intro runs even if `canplay` is missed or
  // already fired before mount (e.g. a cached video).
  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 1200);
    return () => window.clearTimeout(id);
  }, []);

  // Once the first clip is ready and the hero has faded in, type the title out
  // one character at a time. Reduced-motion users get the full title at once.
  useEffect(() => {
    if (!ready || reduced) return;
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
  }, [ready, reduced]);

  // Nothing renders until the hero is ready (keeps SSR/hydration output empty);
  // reduced-motion then jumps straight to the full title.
  const shown = ready ? (reduced ? TITLE.length : typedCount) : 0;
  const typingDone = shown >= TITLE.length;

  // Drive playback explicitly so every cut is a clean restart: the active clip
  // plays from frame 0, while inactive clips are paused and rewound so they're
  // ready at 0 the next time around (no background drift, no mid-clip frame).
  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (!video) return;
      if (index === active) {
        video.currentTime = 0;
        void video.play().catch(() => {});
      } else {
        video.pause();
        video.currentTime = 0;
      }
    });
  }, [active]);

  return (
    <section
      className={`${styles.hero} ${ready ? styles.ready : ""}`}
      aria-label="Meet ZODE One"
    >
      {CLIPS.map((src, index) => (
        <video
          key={src}
          ref={(el) => {
            videoRefs.current[index] = el;
          }}
          className={`${styles.video} ${index === active ? styles.active : ""}`}
          src={src}
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          onCanPlay={index === 0 ? () => setReady(true) : undefined}
        />
      ))}
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
          The first rapidly deployable data center to respond to the AI energy
          crisis.
        </p>
      </div>
    </section>
  );
}
