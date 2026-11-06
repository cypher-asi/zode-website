"use client";

import { useEffect, useRef } from "react";
import { sharedVisitPath } from "./types";

/**
 * Measures how long a share link's recipient reads the room, and each file
 * open in its viewer. Only foreground time counts, and none past five minutes
 * without input. Running totals go to the link's visit route on a heartbeat and
 * whenever the page is hidden or left.
 */

const HEARTBEAT_MS = 15_000;
const IDLE_MS = 5 * 60_000;
const ACTIVITY = ["pointerdown", "pointermove", "keydown", "wheel", "scroll", "touchstart"] as const;

interface Tracker {
  setFile(fileId: string | null): void;
  stop(): void;
}

function startTracker(token: string): Tracker {
  const url = sharedVisitPath(token);
  const visible = () => document.visibilityState === "visible";
  let visit: string | null = null;
  let totalMs = 0;
  const fileMs = new Map<string, number>();
  let file: string | null = null;
  let since: number | null = visible() ? performance.now() : null;
  let lastActive = performance.now();
  let sentMs = -1;

  /** Adds the time since the last bank, up to when input stopped, to the room and the open file. */
  const bank = () => {
    const now = performance.now();
    if (since !== null) {
      const ms = Math.max(0, Math.min(now, lastActive + IDLE_MS) - since);
      totalMs += ms;
      if (file) fileMs.set(file, (fileMs.get(file) ?? 0) + ms);
    }
    since = visible() ? now : null;
  };

  const flush = (beacon: boolean) => {
    if (!visit) return;
    const ms = Math.round(totalMs);
    if (ms === sentMs) return;
    sentMs = ms;
    const files = Object.fromEntries([...fileMs].map(([id, value]) => [id, Math.round(value)]));
    const body = JSON.stringify({ visit, ms, files });
    try {
      if (beacon && navigator.sendBeacon?.(url, body)) return;
      void fetch(url, { method: "POST", body, keepalive: true, credentials: "same-origin" }).catch(() => {});
    } catch {
      // Tracking never gets in the way of the room.
    }
  };

  const onActivity = () => {
    const now = performance.now();
    if (now - lastActive > IDLE_MS) bank();
    lastActive = now;
  };

  const onVisibility = () => {
    bank();
    if (!visible()) flush(true);
  };

  const onHide = () => {
    bank();
    flush(true);
  };

  const timer = window.setInterval(() => {
    if (!visible()) return;
    bank();
    flush(false);
  }, HEARTBEAT_MS);

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onHide);
  for (const type of ACTIVITY) document.addEventListener(type, onActivity, { capture: true, passive: true });

  let stopped = false;
  void fetch(url, { method: "POST", body: "{}", credentials: "same-origin" })
    .then((res) => (res.ok && res.status !== 204 ? (res.json() as Promise<{ visit: string | null }>) : null))
    .then((data) => {
      if (!stopped) visit = data?.visit ?? null;
    })
    .catch(() => {});

  return {
    setFile(fileId) {
      bank();
      file = fileId;
    },
    stop() {
      bank();
      flush(true);
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      for (const type of ACTIVITY) document.removeEventListener(type, onActivity, { capture: true });
    },
  };
}

/** Tracks this page's visit to the share link `token`, crediting time to `fileId` while it's open. */
export function useShareVisit(token: string, fileId: string | null): void {
  const tracker = useRef<Tracker | null>(null);

  useEffect(() => {
    const current = startTracker(token);
    tracker.current = current;
    return () => {
      current.stop();
      tracker.current = null;
    };
  }, [token]);

  useEffect(() => {
    tracker.current?.setFile(fileId);
  }, [fileId]);
}
