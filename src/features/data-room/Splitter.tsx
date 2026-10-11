"use client";

import { useCallback, useEffect, useRef, type ReactElement, type RefObject } from "react";
import styles from "./DataRoomApp.module.css";

const MIN_WIDTH = 220;
/** Room left for the viewer beside the tree. */
const MIN_REMAINDER = 320;
const DEFAULT_WIDTH = 340;
const STEP = 24;

/**
 * The draggable divider between the file tree and the viewer. It writes
 * `--tree-width` on the container directly, so dragging doesn't re-render, and
 * remembers the width per browser.
 */
export function Splitter({
  containerRef,
  storageKey,
}: {
  containerRef: RefObject<HTMLElement | null>;
  storageKey: string;
}): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const width = useRef(DEFAULT_WIDTH);

  const apply = useCallback(
    (next: number) => {
      const container = containerRef.current;
      if (!container) return;
      const max = Math.max(MIN_WIDTH, container.clientWidth - MIN_REMAINDER);
      width.current = Math.round(Math.min(max, Math.max(MIN_WIDTH, next)));
      container.style.setProperty("--tree-width", `${width.current}px`);
      ref.current?.setAttribute("aria-valuenow", String(width.current));
      ref.current?.setAttribute("aria-valuemax", String(max));
    },
    [containerRef],
  );

  const save = useCallback(() => {
    try {
      localStorage.setItem(storageKey, String(width.current));
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
    apply(saved || DEFAULT_WIDTH);
    const onResize = () => apply(width.current);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [apply, storageKey]);

  return (
    <div
      ref={ref}
      className={styles.splitter}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize file list"
      aria-valuemin={MIN_WIDTH}
      aria-valuenow={DEFAULT_WIDTH}
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
        apply(DEFAULT_WIDTH);
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
