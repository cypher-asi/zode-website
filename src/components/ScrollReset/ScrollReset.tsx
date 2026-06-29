"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

// useLayoutEffect runs before paint on the client; fall back to useEffect on
// the server to avoid React's SSR warning (the effect is a no-op there).
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface ScrollResetProps {
  /** Id of the scroll container to reset to the top on navigation. */
  readonly targetId: string;
}

/**
 * Resets a custom scroll container to the top whenever the route changes.
 * The app scrolls an inner element (not the window), so the App Router's
 * built-in scroll restoration does not apply and the previous page's scroll
 * position would otherwise carry over across navigations.
 *
 * Runs in a layout effect so the reset happens after the new page commits but
 * before the browser paints — otherwise the incoming page is painted for a
 * frame at the previous scroll position before snapping to the top.
 */
export function ScrollReset({ targetId }: ScrollResetProps): null {
  const pathname = usePathname();

  useIsomorphicLayoutEffect(() => {
    const el = document.getElementById(targetId);
    if (el) el.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, targetId]);

  return null;
}
