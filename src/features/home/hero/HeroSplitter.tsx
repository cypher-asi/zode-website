"use client";

import { useCallback, useEffect, useRef, type ReactElement } from "react";
import styles from "./HeroSplitter.module.css";

/** Bounds on the white panel's share of the hero, in percent. */
const MIN_SPLIT = 30;
const MAX_SPLIT = 70;
/** Room always left for the gallery, in px. */
const MIN_GALLERY = 360;
const DEFAULT_SPLIT = 50;
const STEP = 2;

const heroOf = (el: HTMLElement | null) => el?.closest<HTMLElement>("[data-hero]") ?? null;

/**
 * The draggable divider between the hero's headline panel and its gallery.
 * Rendered inside the headline panel on its right edge, so it follows the real
 * seam even when the headline's min-content width overrides the requested
 * split. It writes `--hero-split` on the `[data-hero]` grid directly, so
 * dragging doesn't re-render; the split resets to 50/50 on every visit.
 */
export function HeroSplitter(): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  /** The split as laid out, which the headline's min-content can push past the requested one. */
  const split = useRef(DEFAULT_SPLIT);

  const apply = useCallback((next: number) => {
    const grid = heroOf(ref.current);
    if (!grid) return;
    const width = grid.clientWidth;
    const max = width > 0 ? Math.min(MAX_SPLIT, ((width - MIN_GALLERY) / width) * 100) : MAX_SPLIT;
    split.current = Math.round(Math.min(Math.max(MIN_SPLIT, max), Math.max(MIN_SPLIT, next)) * 10) / 10;
    grid.style.setProperty("--hero-split", `${split.current}%`);
    const panel = ref.current?.parentElement;
    if (panel && width > 0) {
      const actual = (panel.getBoundingClientRect().width / width) * 100;
      split.current = Math.max(split.current, Math.round(actual * 10) / 10);
    }
    ref.current?.setAttribute("aria-valuenow", String(Math.round(split.current)));
  }, []);

  useEffect(() => {
    const onResize = () => apply(split.current);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [apply]);

  return (
    <div
      ref={ref}
      className={styles.splitter}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize hero panels"
      aria-valuemin={MIN_SPLIT}
      aria-valuemax={MAX_SPLIT}
      aria-valuenow={DEFAULT_SPLIT}
      tabIndex={0}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const grid = heroOf(event.currentTarget);
        if (!grid) return;
        event.preventDefault();
        const target = event.currentTarget;
        target.setPointerCapture(event.pointerId);
        const rect = grid.getBoundingClientRect();
        const move = (e: PointerEvent) => apply(((e.clientX - rect.left) / rect.width) * 100);
        const root = document.documentElement;
        const end = () => {
          target.removeEventListener("pointermove", move);
          target.removeEventListener("pointerup", end);
          target.removeEventListener("pointercancel", end);
          root.removeAttribute("data-resizing");
          root.style.removeProperty("cursor");
          root.style.removeProperty("user-select");
        };
        // The cursor and no-select hold across the whole page while dragging, even off the divider.
        root.setAttribute("data-resizing", "");
        root.style.cursor = "col-resize";
        root.style.userSelect = "none";
        target.addEventListener("pointermove", move);
        target.addEventListener("pointerup", end);
        target.addEventListener("pointercancel", end);
      }}
      onDoubleClick={() => apply(DEFAULT_SPLIT)}
      onKeyDown={(event) => {
        const delta = { ArrowLeft: -STEP, ArrowRight: STEP }[event.key];
        if (delta) apply(split.current + delta);
        else if (event.key === "Home") apply(MIN_SPLIT);
        else if (event.key === "End") apply(MAX_SPLIT);
        else return;
        event.preventDefault();
      }}
    />
  );
}
