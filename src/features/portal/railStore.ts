"use client";

import { useSyncExternalStore } from "react";
import { PORTAL_RAIL_COOKIE, readPortalRail, type PortalRail } from "./rail";

/** The rail cookie as a store; the cookie has no change event, so `togglePortalRail` notifies. */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function togglePortalRail(): void {
  const next = readPortalRail(document.cookie) === "expanded" ? "collapsed" : "expanded";
  document.cookie = `${PORTAL_RAIL_COOKIE}=${next}; Max-Age=31536000; Path=/; SameSite=Lax`;
  listeners.forEach((listener) => listener());
}

/** The rail per its cookie; collapsed on the server and while hydrating, which an inline script covers. */
export function usePortalRailCookie(): PortalRail {
  return useSyncExternalStore(
    subscribe,
    () => readPortalRail(document.cookie),
    (): PortalRail => "collapsed",
  );
}
