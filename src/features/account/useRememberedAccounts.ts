"use client";

import { useSyncExternalStore } from "react";
import { ACCOUNTS_CHANGED, parseAccounts, readStoredAccounts, type RememberedAccount } from "./rememberedAccounts";

const NONE: readonly RememberedAccount[] = [];

// Parsed once per stored value, so the snapshot keeps its identity between reads.
let cachedRaw: string | null = null;
let cached: readonly RememberedAccount[] = NONE;

function getSnapshot(): readonly RememberedAccount[] {
  const raw = readStoredAccounts();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parseAccounts(raw);
  }
  return cached;
}

function subscribe(listener: () => void): () => void {
  window.addEventListener("storage", listener);
  window.addEventListener(ACCOUNTS_CHANGED, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(ACCOUNTS_CHANGED, listener);
  };
}

/** Accounts remembered on this device, most recent first. Empty on the server and during hydration. */
export function useRememberedAccounts(): readonly RememberedAccount[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => NONE);
}
