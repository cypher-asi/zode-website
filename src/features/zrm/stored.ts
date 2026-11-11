"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Settings remembered per browser, e.g. a list's collapsed sections. Kept in
 * memory too, so they still apply for the visit where storage is unavailable
 * (private mode). The server, and a page's first render, see `null`.
 */
const memory = new Map<string, string>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function read(key: string): string | null {
  const remembered = memory.get(key);
  if (remembered !== undefined) return remembered;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useStored(key: string): [string | null, (value: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  const set = useCallback(
    (next: string) => {
      memory.set(key, next);
      try {
        localStorage.setItem(key, next);
      } catch {
        // Storage can be unavailable; the setting just isn't remembered across visits.
      }
      for (const listener of listeners) listener();
    },
    [key],
  );
  return [value, set];
}
