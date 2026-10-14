"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  clearBackOrigin,
  isDetourPath,
  isNeutralPath,
  takeBackRestore,
  writeBackOrigin,
  type BackOrigin as Origin,
} from "@/lib/backOrigin";

/** Frames to keep re-applying a restored scroll position while late sections mount and grow the page. */
const RESTORE_FRAMES = 60;

function currentHref(): string {
  const { pathname, search, hash } = window.location;
  return `${pathname}${search}${hash}`;
}

/**
 * Remembers the last ordinary page you were on (and how far down it) and,
 * when a navigation steps into a detour, stores it as the header's Back
 * target. Lives in the root layout because each page mounts its own header,
 * which can't see the route before it. Returning to an ordinary page clears
 * the target, and a Back click's scroll position is restored here.
 */
export function BackOrigin(): null {
  const pathname = usePathname();
  /** The ordinary page currently (or most recently) shown; `null` once handed off to a detour. */
  const last = useRef<Origin | null>(null);

  useEffect(() => {
    const onScroll = () => {
      // The URL already reads the next route by the time a navigation scrolls to the top, so this skips it.
      const path = window.location.pathname;
      if (!last.current || isDetourPath(path) || isNeutralPath(path)) return;
      if (new URL(last.current.href, window.location.origin).pathname !== path) return;
      last.current = { href: currentHref(), scrollY: window.scrollY };
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!pathname || isNeutralPath(pathname)) return;
    if (isDetourPath(pathname)) {
      if (last.current) writeBackOrigin(last.current);
      last.current = null;
      return;
    }

    clearBackOrigin();
    last.current = { href: currentHref(), scrollY: window.scrollY };

    const restore = takeBackRestore();
    if (!restore || new URL(restore.href, window.location.origin).pathname !== pathname) return;
    let frames = 0;
    let frame = 0;
    const step = () => {
      window.scrollTo({ top: restore.scrollY, behavior: "instant" });
      if (Math.abs(window.scrollY - restore.scrollY) > 1 && ++frames < RESTORE_FRAMES) {
        frame = requestAnimationFrame(step);
      }
    };
    step();
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return null;
}
