/**
 * The header's Back pill: the page before this one in the tab's history, so
 * it steps back exactly like the browser's Back button (deck, then portal,
 * then Back lands on the deck). Read through the Navigation API, which lists
 * the tab's same-origin entries, so the page you landed on (from another site
 * or a fresh tab) has none; where the API is missing the pill stays hidden.
 */

interface HistoryEntry {
  readonly url: string | null;
  readonly index: number;
}

interface Navigation extends EventTarget {
  readonly currentEntry: HistoryEntry | null;
  entries(): HistoryEntry[];
}

function navigation(): Navigation | null {
  return (window as Window & { navigation?: Navigation }).navigation ?? null;
}

function localHref(url: string | null): string | null {
  if (!url) return null;
  const { pathname, search, hash } = new URL(url);
  return `${pathname}${search}${hash}`;
}

/**
 * Where Back leads from `pathname`, the route being rendered. A link's new
 * route renders before the router pushes its history entry, so while the
 * current entry still names another page, that page is the one Back leads to;
 * this keeps the pill in the route transition's first frame.
 */
export function readBackHref(pathname: string): string | null {
  const current = navigation()?.currentEntry;
  if (!current?.url) return null;
  if (new URL(current.url).pathname !== pathname) return localHref(current.url);
  return localHref(navigation()?.entries()[current.index - 1]?.url ?? null);
}

/**
 * The router pushes its entry from an insertion effect, where `pushState`
 * fires `currententrychange` synchronously and React refuses the update, so
 * the change is reported once the commit is done.
 */
export function subscribeHistory(onChange: () => void): () => void {
  const nav = navigation();
  const notify = () => queueMicrotask(onChange);
  nav?.addEventListener("currententrychange", notify);
  return () => nav?.removeEventListener("currententrychange", notify);
}

/**
 * Takes the Back step through history, so it restores the page's scroll like
 * the browser's Back button. Returns false when the router hasn't pushed
 * `pathname`'s entry yet, leaving the link to navigate.
 */
export function stepBack(pathname: string): boolean {
  const current = navigation()?.currentEntry;
  if (!current?.url || new URL(current.url).pathname !== pathname || current.index < 1) return false;
  window.history.back();
  return true;
}
