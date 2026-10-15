"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 10_000;

/**
 * Refreshes the portal when the account's rooms or invites change elsewhere,
 * e.g. a room shared with it, so they appear without a reload. Polls while the
 * tab is visible, and as soon as it's shown again. `version` is what the
 * current render was built from.
 */
export function RoomsWatcher({ version }: { version: string }): null {
  const router = useRouter();
  const seen = useRef(version);

  useEffect(() => {
    seen.current = version;
  }, [version]);

  useEffect(() => {
    let busy = false;
    const check = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const res = await fetch("/api/data-rooms/mine", { cache: "no-store" });
        if (!res.ok) return;
        const { v } = (await res.json()) as { v?: string };
        if (typeof v === "string" && v !== seen.current) {
          seen.current = v;
          router.refresh();
        }
      } catch {
        // Offline or mid-deploy; the next tick tries again.
      } finally {
        busy = false;
      }
    };
    const onVisible = () => void check();
    const id = window.setInterval(onVisible, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [router]);

  return null;
}
