"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import Image from "next/image";
import styles from "./FooterScene.module.css";

/** How long each landscape holds before cross-fading to the next. */
const INTERVAL = 3000;

/**
 * Each photo has the same ZODE composited at the same pixel position (see
 * `.image` for the point it's anchored on), so cross-fading between them
 * changes only the surroundings.
 */
const SCENES = [
  { id: "city", label: "Downtown" },
  { id: "field", label: "Open prairie" },
  { id: "mountain", label: "Alpine meadow" },
  { id: "desert", label: "High desert" },
  { id: "coast", label: "Coastline" },
  { id: "snow", label: "Boreal winter" },
] as const;

/**
 * Closing band of the page: a ZODE that never moves while the landscape
 * around it rotates. Rotation runs only while the band is on screen and the
 * tab is visible; under `prefers-reduced-motion` the first scene stays put.
 */
export function FooterScene(): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const [{ active, prev }, setShown] = useState({ active: 0, prev: -1 });

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let timer = 0;
    let visible = false;
    const sync = () => {
      const run = visible && !document.hidden;
      if (run && !timer) {
        timer = window.setInterval(
          () => setShown(({ active: a }) => ({ active: (a + 1) % SCENES.length, prev: a })),
          INTERVAL,
        );
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

  return (
    <div ref={ref} className={styles.root} data-surface="light" aria-hidden="true">
      {SCENES.map((scene, i) => (
        <Image
          key={scene.id}
          className={styles.image}
          data-active={i === active || undefined}
          data-prev={i === prev || undefined}
          src={`/images/future-home/footer/${scene.id}-wide.jpg`}
          alt=""
          fill
          sizes="100vw"
        />
      ))}

      <p className={styles.captions}>
        {SCENES.map((scene, i) => (
          <span key={scene.id} className={styles.caption} data-active={i === active || undefined}>
            {String(i + 1).padStart(2, "0")} / {String(SCENES.length).padStart(2, "0")}
            <span className={styles.label}>{scene.label}</span>
          </span>
        ))}
      </p>
    </div>
  );
}
