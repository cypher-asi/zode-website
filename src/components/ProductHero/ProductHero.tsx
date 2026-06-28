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

/**
 * Full-bleed hero for the Product page: a looping sequence of video clips with
 * a bottom gradient scrim and bottom-left intro copy. Sits inside the (site)
 * shell's normally-scrolling body panel.
 */
export function ProductHero(): ReactElement {
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(false);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActive((index) => (index + 1) % CLIPS.length);
    }, CLIP_DURATION_MS);
    return () => window.clearInterval(id);
  }, []);

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
