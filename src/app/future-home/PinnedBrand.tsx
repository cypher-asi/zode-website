"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactElement } from "react";
import styles from "./PinnedBrand.module.css";

type Tone = "light" | "dark";

/**
 * Top-left wordmark that stays fixed while the page scrolls. Black over light
 * surfaces and white over dark ones: it reads the nearest `data-surface`
 * ancestor of whatever sits under its center point.
 */
export function PinnedBrand(): ReactElement {
  const ref = useRef<HTMLAnchorElement>(null);
  const [tone, setTone] = useState<Tone>("light");

  useEffect(() => {
    let frame = 0;

    const sample = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      for (const node of document.elementsFromPoint(x, y)) {
        if (el.contains(node)) continue;
        const surface = node.closest<HTMLElement>("[data-surface]")?.dataset.surface;
        if (surface === "light" || surface === "dark") {
          setTone(surface);
          return;
        }
      }
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(sample);
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <Link ref={ref} className={styles.brand} href="/" aria-label="ZODE — home" data-tone={tone}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.wordmark} src="/wordmark.png" alt="" aria-hidden="true" />
    </Link>
  );
}
