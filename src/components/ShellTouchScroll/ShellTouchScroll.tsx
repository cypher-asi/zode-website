"use client";

import { useEffect } from "react";

interface ShellTouchScrollProps {
  /** Id of the scroll container that touches on the shell should drive. */
  readonly scrollTargetId: string;
}

// Below this speed (px/frame) the inertial fling is considered finished.
const MIN_FLING_VELOCITY = 0.4;
// Per-frame velocity decay for the inertial fling — tuned to feel close to
// native iOS momentum without overshooting.
const FLING_DECAY = 0.92;

/**
 * iOS (and other touch browsers) only scroll a container when the gesture
 * begins *inside* it. Swipes that start on the surrounding shell chrome — the
 * top nav, bottom taskbar, or the panel's side margins — otherwise rubber-band
 * the whole page instead of scrolling the content.
 *
 * This forwards those chrome-originating swipes into the scroll container: it
 * drives `scrollTop` directly while the finger moves (calling `preventDefault`
 * to suppress the native page bounce) and adds a short inertial fling on
 * release. Touches that start inside the scroll container, or on the overlay
 * scrollbar, are left untouched so native content scrolling still works.
 *
 * Renders nothing; it only wires DOM listeners onto the existing shell frame.
 */
export function ShellTouchScroll({ scrollTargetId }: ShellTouchScrollProps): null {
  useEffect(() => {
    const target = document.getElementById(scrollTargetId);
    if (!target) return;

    const shell: HTMLElement =
      target.closest<HTMLElement>("[data-shell-root]") ?? document.documentElement;

    let lastY: number | null = null;
    let lastT = 0;
    let velocity = 0;
    let flingFrame = 0;

    const cancelFling = (): void => {
      if (flingFrame !== 0) {
        cancelAnimationFrame(flingFrame);
        flingFrame = 0;
      }
    };

    // The gesture is "ours" only when it starts outside the scroll container
    // (on the chrome) and not on the overlay scrollbar, which drives its own
    // drag-to-scroll.
    const shouldForward = (node: EventTarget | null): boolean => {
      if (!(node instanceof Node)) return false;
      if (target.contains(node)) return false;
      if (node instanceof Element && node.closest("[data-overlay-scrollbar]")) {
        return false;
      }
      return true;
    };

    const onTouchStart = (event: TouchEvent): void => {
      if (!shouldForward(event.target)) {
        lastY = null;
        return;
      }
      cancelFling();
      lastY = event.touches[0]?.clientY ?? null;
      lastT = event.timeStamp;
      velocity = 0;
    };

    const onTouchMove = (event: TouchEvent): void => {
      if (lastY === null) return;
      const y = event.touches[0]?.clientY ?? lastY;
      const dy = lastY - y;
      const dt = event.timeStamp - lastT || 16;
      lastY = y;
      lastT = event.timeStamp;
      velocity = dy / dt;
      target.scrollTop += dy;
      // Stop the shell/page from rubber-banding under the finger.
      event.preventDefault();
    };

    const onTouchEnd = (): void => {
      if (lastY === null) return;
      lastY = null;
      // Convert px/ms into an initial px/frame velocity for the fling.
      let v = velocity * 16;
      if (Math.abs(v) <= 1) return;
      const stepFling = (): void => {
        if (Math.abs(v) < MIN_FLING_VELOCITY) {
          flingFrame = 0;
          return;
        }
        const before = target.scrollTop;
        target.scrollTop += v;
        // Hit the top or bottom: nothing more to scroll, so end the fling.
        if (target.scrollTop === before) {
          flingFrame = 0;
          return;
        }
        v *= FLING_DECAY;
        flingFrame = requestAnimationFrame(stepFling);
      };
      flingFrame = requestAnimationFrame(stepFling);
    };

    shell.addEventListener("touchstart", onTouchStart, { passive: true });
    shell.addEventListener("touchmove", onTouchMove, { passive: false });
    shell.addEventListener("touchend", onTouchEnd, { passive: true });
    shell.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      cancelFling();
      shell.removeEventListener("touchstart", onTouchStart);
      shell.removeEventListener("touchmove", onTouchMove);
      shell.removeEventListener("touchend", onTouchEnd);
      shell.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [scrollTargetId]);

  return null;
}
