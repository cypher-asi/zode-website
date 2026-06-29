"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Reports when `ref`'s element has scrolled within `rootMargin` of the
 * viewport. Latches to `true` on the first intersection and then stops
 * observing, so it is ideal for one-shot "mount this heavy widget once it is
 * about to be seen" gates. Falls back to `true` where IntersectionObserver is
 * unavailable (e.g. very old browsers) so content is never permanently hidden.
 */
export function useInView(
  ref: RefObject<Element | null>,
  rootMargin = "200px 0px",
): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === "undefined") {
      // No observer support: reveal on the next microtask (avoids a
      // synchronous setState in the effect body) so content is never stuck.
      let cancelled = false;
      Promise.resolve().then(() => {
        if (!cancelled) setInView(true);
      });
      return () => {
        cancelled = true;
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, rootMargin, inView]);

  return inView;
}
