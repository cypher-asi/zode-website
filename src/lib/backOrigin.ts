/**
 * The page you left to open one of the site's detours (the deck, buy/rent
 * compute, the portal, the compute model, the cluster builder), which the
 * header's Back button returns to. Kept per tab in sessionStorage; see
 * features/navigation/BackOrigin for when it's set and cleared.
 */

export interface BackOrigin {
  readonly href: string;
  readonly scrollY: number;
}

/** Sections you step into from the site and come back out of. Moving between them keeps the origin. */
const DETOUR_PREFIXES = ["/deck", "/buy-compute", "/portal", "/compute-model", "/cluster-builder"];

/** Modals and auth open over or between pages, so they neither set nor clear the origin. */
const NEUTRAL_PATHS = ["/invest", "/talk-to-an-engineer", "/login", "/register"];

const ORIGIN_KEY = "zode:back-origin";
const RESTORE_KEY = "zode:back-restore";
const CHANGE_EVENT = "zode:back-origin-change";

function matches(pathname: string, paths: readonly string[]): boolean {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function isDetourPath(pathname: string): boolean {
  return matches(pathname, DETOUR_PREFIXES);
}

export function isNeutralPath(pathname: string): boolean {
  return matches(pathname, NEUTRAL_PATHS);
}

/** The stored origin as its raw JSON, a stable snapshot for `useSyncExternalStore`. */
export function readBackOriginRaw(): string | null {
  try {
    return sessionStorage.getItem(ORIGIN_KEY);
  } catch {
    return null;
  }
}

export function parseBackOrigin(raw: string | null): BackOrigin | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<BackOrigin>;
    if (typeof value.href !== "string" || !value.href.startsWith("/")) return null;
    return { href: value.href, scrollY: typeof value.scrollY === "number" ? value.scrollY : 0 };
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private modes, quotas); the button just stays hidden.
  }
}

export function writeBackOrigin(origin: BackOrigin): void {
  write(ORIGIN_KEY, JSON.stringify(origin));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearBackOrigin(): void {
  if (readBackOriginRaw() === null) return;
  write(ORIGIN_KEY, null);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeBackOrigin(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Flags the origin's scroll position to be restored once its page is back. */
export function requestBackRestore(origin: BackOrigin): void {
  write(RESTORE_KEY, JSON.stringify(origin));
}

/** The pending restore, if any, removed as it's read. */
export function takeBackRestore(): BackOrigin | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(RESTORE_KEY);
  } catch {
    return null;
  }
  write(RESTORE_KEY, null);
  return parseBackOrigin(raw);
}
