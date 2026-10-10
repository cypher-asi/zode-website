"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import { LANDSCAPES, VIEW, ZODE } from "./landscapes";
import styles from "./FooterScene.module.css";

/** How long each landscape holds before cross-fading to the next. */
const INTERVAL = 3000;

/**
 * Closing band of the page: landscape line drawings cross-fade behind a ZODE
 * that never moves. Rotation runs only while the band is on screen and the
 * tab is visible; under `prefers-reduced-motion` the first scene stays put.
 */
export function FooterScene(): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let timer = 0;
    let visible = false;
    const sync = () => {
      const run = visible && !document.hidden;
      if (run && !timer) {
        timer = window.setInterval(() => setActive((i) => (i + 1) % LANDSCAPES.length), INTERVAL);
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
      <svg className={styles.art} viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}>
        {LANDSCAPES.map((scene, i) => (
          <g key={scene.id} className={styles.scene} data-active={i === active || undefined}>
            {scene.items}
          </g>
        ))}
        {ZODE}
      </svg>

      <p className={styles.captions}>
        {LANDSCAPES.map((scene, i) => (
          <span key={scene.id} className={styles.caption} data-active={i === active || undefined}>
            {String(i + 1).padStart(2, "0")} / {String(LANDSCAPES.length).padStart(2, "0")}
            <span className={styles.label}>{scene.label}</span>
          </span>
        ))}
      </p>
    </div>
  );
}
