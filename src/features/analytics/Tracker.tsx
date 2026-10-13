"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isUntracked } from "./classify";
import { startTracking, trackPageview } from "./track";

/**
 * Counts a pageview on load and on every navigation inside the site, which
 * keeps the root layout mounted. Query-string changes on the same path, like
 * a report's filters, aren't new pageviews.
 */
export function Tracker(): null {
  const pathname = usePathname();

  useEffect(() => {
    startTracking();
  }, []);

  useEffect(() => {
    if (pathname && !isUntracked(pathname)) trackPageview(pathname);
  }, [pathname]);

  return null;
}
