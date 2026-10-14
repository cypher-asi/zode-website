"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Reports whether `ref`'s element is within `rootMargin` of the viewport,
 * following it both ways (unlike useInView, which latches), e.g. to pause
 * looping animations while they're out of sight. Starts `true`, so whatever
 * it gates runs as server-rendered until the observer's first report, and
 * stays `true` where IntersectionObserver is unavailable.
 */
export function useOnScreen(ref: RefObject<Element | null>, rootMargin = "100px 0px"): boolean {
  const [onScreen, setOnScreen] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => setOnScreen(entries[entries.length - 1].isIntersecting),
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, rootMargin]);

  return onScreen;
}
