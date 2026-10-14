"use client";

import { useSyncExternalStore } from "react";
import { PORTAL_THEME_COOKIE, readPortalTheme, type PortalTheme } from "./theme";

/** The theme cookie as a store; the cookie has no change event, so `togglePortalTheme` notifies. */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function togglePortalTheme(): void {
  const next = readPortalTheme(document.cookie) === "dark" ? "light" : "dark";
  document.cookie = `${PORTAL_THEME_COOKIE}=${next}; Max-Age=31536000; Path=/; SameSite=Lax`;
  listeners.forEach((listener) => listener());
}

/** The portal's theme per its cookie; light on the server and while hydrating, which an inline script covers. */
export function usePortalThemeCookie(): PortalTheme {
  return useSyncExternalStore(
    subscribe,
    () => readPortalTheme(document.cookie),
    (): PortalTheme => "light",
  );
}
