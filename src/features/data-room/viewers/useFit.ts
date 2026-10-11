"use client";

import { useEffect, useState, type RefObject } from "react";

/** The panel's content box, kept current as the divider or window moves. */
export function usePanelSize(ref: RefObject<HTMLElement | null>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/** Scale that fits `contentWidth` across the panel with some breathing room, capped at `max`. */
export function fitWidth(panelWidth: number, contentWidth: number, max = 2): number {
  if (!panelWidth || !contentWidth) return 1;
  return Math.max(0.1, Math.min(max, (panelWidth - 48) / contentWidth));
}
