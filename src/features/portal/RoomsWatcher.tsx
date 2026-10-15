"use client";

import { useEffect, useRef } from "react";
import { refreshMyRoomsAction } from "@/features/data-room/actions";

/**
 * Keeps the portal's rooms and invites current: the server pushes the
 * account's rooms fingerprint over an event stream whenever it changes, e.g.
 * a room shared with it, and the page re-renders when that differs from the
 * one it was built from (`version`). A change while the tab is hidden waits
 * until it's shown. The browser reconnects the stream by itself.
 */
export function RoomsWatcher({ version }: { version: string }): null {
  const seen = useRef(version);

  useEffect(() => {
    seen.current = version;
  }, [version]);

  useEffect(() => {
    let stale = false;
    const refresh = () => {
      if (document.visibilityState === "visible") {
        stale = false;
        void refreshMyRoomsAction();
      } else {
        stale = true;
      }
    };
    const onVisible = () => {
      if (stale && document.visibilityState === "visible") refresh();
    };

    const source = new EventSource("/api/data-rooms/events");
    source.addEventListener("rooms", (event) => {
      const next = (event as MessageEvent<string>).data;
      if (next === seen.current) return;
      seen.current = next;
      refresh();
    });
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      source.close();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
