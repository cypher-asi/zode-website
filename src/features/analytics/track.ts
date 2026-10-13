"use client";

import type { ClientEvent, EventProps } from "./events";

/**
 * The browser half of the site's analytics: one pageview per path, the time
 * it spends visible and how far it's scrolled, and `track()` for events.
 * Everything goes to /api/analytics/collect, which sets the cookies.
 */

const ENDPOINT = "/api/analytics/collect";
const UTM_KEYS = ["source", "medium", "campaign", "content", "term"] as const;

interface Page {
  id: string;
  path: string;
  /** Visible time banked before the current stretch. */
  engagedMs: number;
  /** When the current visible stretch began, or `null` while hidden. */
  visibleSince: number | null;
  scrollPct: number;
  /** What the last engage beacon reported, so unchanged pages aren't resent. */
  sentMs: number;
  sentScroll: number;
}

let page: Page | null = null;
let firstLoad = true;

/** The browser asked not to be tracked: Global Privacy Control or Do Not Track. */
function optedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || navigator.doNotTrack === "1";
}

function post(body: object, beacon: boolean): void {
  const json = JSON.stringify(body);
  try {
    if (beacon && navigator.sendBeacon?.(ENDPOINT, json)) return;
    void fetch(ENDPOINT, { method: "POST", body: json, keepalive: true, credentials: "same-origin" }).catch(() => {});
  } catch {
    // Analytics never gets in the way of the page.
  }
}

function engagedMs(current: Page): number {
  return current.engagedMs + (current.visibleSince === null ? 0 : performance.now() - current.visibleSince);
}

function scrollPct(): number {
  const doc = document.documentElement;
  const scrollable = doc.scrollHeight - window.innerHeight;
  if (scrollable <= 0) return 100;
  return Math.min(100, Math.round((window.scrollY / scrollable) * 100));
}

/** Sends the open page's engaged time and scroll depth, if they moved since the last send. */
function flush(): void {
  if (!page) return;
  const ms = Math.round(engagedMs(page));
  if (ms - page.sentMs < 500 && page.scrollPct === page.sentScroll) return;
  page.sentMs = ms;
  page.sentScroll = page.scrollPct;
  post({ t: "engage", id: page.id, ms, scroll: page.scrollPct }, true);
}

function utm(): Partial<Record<(typeof UTM_KEYS)[number], string>> | undefined {
  const params = new URLSearchParams(window.location.search);
  const found = Object.fromEntries(
    UTM_KEYS.flatMap((key) => {
      const value = params.get(`utm_${key}`);
      return value ? [[key, value]] : [];
    }),
  );
  return Object.keys(found).length ? found : undefined;
}

/** Counts a pageview for `path`, closing out the page before it. */
export function trackPageview(path: string): void {
  if (optedOut() || page?.path === path) return;
  flush();
  page = {
    id: crypto.randomUUID(),
    path,
    engagedMs: 0,
    visibleSince: document.visibilityState === "visible" ? performance.now() : null,
    scrollPct: 0,
    sentMs: 0,
    sentScroll: 0,
  };
  post(
    {
      t: "pageview",
      id: page.id,
      path,
      title: document.title,
      // Later navigations happen inside the site, so only the first load has a referrer worth keeping.
      ref: firstLoad ? document.referrer : null,
      utm: utm(),
      w: window.screen.width,
      lang: navigator.language,
    },
    false,
  );
  firstLoad = false;
  // Measured once the page has laid out, so one that fits the window counts as read to the end.
  const current = page;
  window.setTimeout(() => {
    if (page === current) page.scrollPct = Math.max(page.scrollPct, scrollPct());
  }, 1000);
}

/** Records a browser event from events.ts on the current page. */
export function track(name: ClientEvent, props: EventProps = {}): void {
  if (optedOut()) return;
  post({ t: "event", name, path: window.location.pathname, props }, true);
}

function onVisibility(): void {
  if (!page) return;
  if (document.visibilityState === "hidden") {
    if (page.visibleSince !== null) {
      page.engagedMs += performance.now() - page.visibleSince;
      page.visibleSince = null;
    }
    flush();
  } else if (page.visibleSince === null) {
    page.visibleSince = performance.now();
  }
}

let scrollQueued = false;
function onScroll(): void {
  if (scrollQueued) return;
  scrollQueued = true;
  requestAnimationFrame(() => {
    scrollQueued = false;
    if (page) page.scrollPct = Math.max(page.scrollPct, scrollPct());
  });
}

const DOWNLOAD = /\.(pdf|zip|docx?|xlsx?|pptx?|csv|dmg|exe|pkg)$/i;

/** Outbound links and downloads, from one listener on the document. */
function onClick(event: MouseEvent): void {
  const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(target instanceof HTMLAnchorElement)) return;
  let url: URL;
  try {
    url = new URL(target.href, window.location.href);
  } catch {
    return;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    if (url.protocol === "mailto:") track("outbound_click", { url: "mailto" });
    return;
  }
  if (target.hasAttribute("download") || DOWNLOAD.test(url.pathname) || url.pathname.endsWith("/pdf")) {
    track("file_download", {
      file: target.getAttribute("download") || decodeURIComponent(url.pathname.split("/").pop() || url.pathname),
      path: url.origin === window.location.origin ? url.pathname : `${url.host}${url.pathname}`,
    });
  } else if (url.origin !== window.location.origin) {
    track("outbound_click", { url: `${url.host}${url.pathname === "/" ? "" : url.pathname}` });
  }
}

let started = false;

/** Listens for visibility, scrolling and clicks; safe to call more than once. */
export function startTracking(): void {
  if (started) return;
  started = true;
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", flush);
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("click", onClick, { capture: true });
}
