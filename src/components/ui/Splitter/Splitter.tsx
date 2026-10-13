"use client";

import { useCallback, useEffect, useRef, type ReactElement, type RefObject } from "react";
import styles from "./Splitter.module.css";

const MIN_WIDTH = 220;
/** Room left for the pane on the right. */
const MIN_REMAINDER = 320;
const STEP = 24;

export interface SplitterProps {
  containerRef: RefObject<HTMLElement | null>;
  /** localStorage key the width is remembered under. */
  storageKey: string;
  /** Accessible name, e.g. "Resize file list". */
  label: string;
  /** The custom property on the container that sizes the left pane. */
  cssVar: string;
  /** Share of the container the left pane takes until it's resized; match the CSS default. */
  defaultFraction: number;
}

/**
 * A draggable divider between two panes in a grid. It writes `cssVar` on the
 * container directly, so dragging doesn't re-render, and remembers the width
 * per browser as a share of the container, so it holds its proportion as the
 * window resizes. Hidden on phones, where the panes stack.
 */
export function Splitter({ containerRef, storageKey, label, cssVar, defaultFraction }: SplitterProps): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const width = useRef(0);
  const fraction = useRef(defaultFraction);

  const apply = useCallback(
    (next: number) => {
      const container = containerRef.current;
      if (!container) return;
      const max = Math.max(MIN_WIDTH, container.clientWidth - MIN_REMAINDER);
      width.current = Math.round(Math.min(max, Math.max(MIN_WIDTH, next)));
      fraction.current = container.clientWidth ? width.current / container.clientWidth : defaultFraction;
      container.style.setProperty(cssVar, `${width.current}px`);
      ref.current?.setAttribute("aria-valuenow", String(width.current));
      ref.current?.setAttribute("aria-valuemax", String(max));
    },
    [containerRef, cssVar, defaultFraction],
  );

  /** Width for a share of the container, e.g. the default or a saved one. */
  const applyFraction = useCallback(
    (share: number) => apply(share * (containerRef.current?.clientWidth ?? 0)),
    [apply, containerRef],
  );

  const save = useCallback(() => {
    try {
      localStorage.setItem(storageKey, fraction.current.toFixed(4));
    } catch {
      // Storage can be unavailable (private mode); the width just isn't remembered.
    }
  }, [storageKey]);

  useEffect(() => {
    let saved = 0;
    try {
      saved = Number(localStorage.getItem(storageKey)) || 0;
    } catch {
      saved = 0;
    }
    applyFraction(saved > 0 && saved < 1 ? saved : defaultFraction);
    const onResize = () => applyFraction(fraction.current);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [applyFraction, defaultFraction, storageKey]);

  return (
    <div
      ref={ref}
      className={styles.splitter}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={MIN_WIDTH}
      tabIndex={0}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        const target = event.currentTarget;
        target.setPointerCapture(event.pointerId);
        const left = containerRef.current?.getBoundingClientRect().left ?? 0;
        const move = (e: PointerEvent) => apply(e.clientX - left);
        const root = document.documentElement;
        const end = () => {
          target.removeEventListener("pointermove", move);
          target.removeEventListener("pointerup", end);
          target.removeEventListener("pointercancel", end);
          root.removeAttribute("data-resizing");
          root.style.removeProperty("cursor");
          root.style.removeProperty("user-select");
          save();
        };
        // The cursor and no-select hold across the whole page while dragging, even off the divider.
        root.setAttribute("data-resizing", "");
        root.style.cursor = "col-resize";
        root.style.userSelect = "none";
        target.addEventListener("pointermove", move);
        target.addEventListener("pointerup", end);
        target.addEventListener("pointercancel", end);
      }}
      onDoubleClick={() => {
        applyFraction(defaultFraction);
        save();
      }}
      onKeyDown={(event) => {
        const delta = { ArrowLeft: -STEP, ArrowRight: STEP }[event.key];
        if (delta) apply(width.current + delta);
        else if (event.key === "Home") apply(MIN_WIDTH);
        else if (event.key === "End") apply(Number.MAX_SAFE_INTEGER);
        else return;
        event.preventDefault();
        save();
      }}
    />
  );
}
