"use client";

import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import styles from "./ProductHero.module.css";

// The hero cycles through these clips, hard-cutting to the next every
// CLIP_DURATION_MS, then loops back to the first. To swap a clip, drop the
// file into public/videos/ and update the matching entry below.
//
// Clips are web-optimized H.264 MP4 (1080p, faststart, no audio). H.264 is
// chosen deliberately: HEVC/H.265 does not decode in Chromium on Linux
// (Brave/Chrome) or in Firefox, which was the original "videos don't load"
// bug. Keep any replacement in H.264 MP4 (or add a matching WebM source).
const CLIPS = [
  "/videos/clip-1.mp4",
  "/videos/clip-2.mp4",
  "/videos/clip-3.mp4",
  "/videos/clip-4.mp4",
  "/videos/clip-5.mp4",
];

/** Shown instantly (and as a decode fallback) while the first clip buffers. */
const POSTER = "/videos/hero-poster.jpg";

const CLIP_DURATION_MS = 2500;

const TITLE = "Meet ZODE One.";

/** Per-character cadence of the title typewriter reveal. */
const TYPE_SPEED_MS = 65;

/** Initial clip fade-in duration; must match the CSS transition below. */
const INTRO_FADE_MS = 800;

/**
 * Full-bleed hero for the Product page: a looping sequence of video clips with
 * a bottom gradient scrim and bottom-left intro copy. Sits inside the (site)
 * shell's normally-scrolling body panel.
 */
export function ProductHero(): ReactElement {
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [typedCount, setTypedCount] = useState(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActive((index) => (index + 1) % CLIPS.length);
    }, CLIP_DURATION_MS);
    return () => window.clearInterval(id);
  }, []);

  // Reveal the hero as soon as the first clip can play, but never block on it:
  // a fallback timer guarantees the intro runs even if `canplay` is missed or
  // already fired before mount (e.g. a cached video), or if decoding fails
  // entirely (the poster still paints under the copy).
  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 1200);
    return () => window.clearTimeout(id);
  }, []);

  // Kick off buffering explicitly on mount. Some browsers (notably Safari)
  // won't reliably begin fetching muted, autoplay-less <video> elements until
  // load() is called, which previously left the hero stuck on a blank frame.
  useEffect(() => {
    videoRefs.current.forEach((video) => video?.load());
  }, []);

  // The clip fade only applies to the first reveal; once it completes, drop
  // the transition so clip-to-clip changes stay instant hard cuts.
  useEffect(() => {
    if (!ready) return;
    const id = window.setTimeout(() => setIntroDone(true), INTRO_FADE_MS);
    return () => window.clearTimeout(id);
  }, [ready]);

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
          className={`${styles.video} ${introDone ? "" : styles.fadeable} ${ready && index === active ? styles.active : ""}`}
          muted
          loop
          playsInline
          preload="auto"
          poster={POSTER}
          aria-hidden="true"
          onCanPlay={index === 0 ? () => setReady(true) : undefined}
        >
          <source src={src} type="video/mp4" />
        </video>
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
