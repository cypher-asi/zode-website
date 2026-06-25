"use client";

import { useEffect } from "react";

interface DeckControllerProps {
  /** Id of the scrollable deck container. */
  readonly scrollRootId: string;
  /** Total number of full-height slides (cover + sections). */
  readonly slideCount: number;
}

const WHEEL_THRESHOLD = 16;
const TOUCH_THRESHOLD = 40;
const LOCK_FALLBACK_MS = 700;
// A single flick on a trackpad or high-resolution mouse emits a long tail of
// momentum `wheel` events. We only re-arm once the wheel has been quiet for
// this long, so one continuous gesture advances exactly one slide.
const WHEEL_IDLE_MS = 140;

/**
 * Turns the native scroll-snap deck into a controlled, one-gesture-equals-
 * one-slide deck. It intercepts wheel, keyboard, and touch input on the
 * scroll container and programmatically advances exactly one full slide per
 * discrete gesture, holding a lock until the smooth scroll settles so a
 * single flick or key press can never skip past a slide.
 *
 * Renders nothing; it only wires DOM listeners to the existing container so
 * the tick rail and IntersectionObserver continue to work unchanged.
 */
export function DeckController({ scrollRootId, slideCount }: DeckControllerProps): null {
  useEffect(() => {
    const root = document.getElementById(scrollRootId);
    if (!root) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let locked = false;
    let lockTimer: ReturnType<typeof setTimeout> | null = null;
    // `armed` gates whether a fresh gesture may trigger a slide. It is consumed
    // on each step and only restored once the wheel goes idle, which absorbs
    // the momentum tail that otherwise skips past slides.
    let armed = true;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const currentIndex = (): number => Math.round(root.scrollTop / root.clientHeight);

    const releaseLock = (): void => {
      locked = false;
      if (lockTimer !== null) {
        clearTimeout(lockTimer);
        lockTimer = null;
      }
    };

    const goTo = (index: number): void => {
      const clamped = Math.max(0, Math.min(slideCount - 1, index));
      const top = clamped * root.clientHeight;
      if (Math.abs(top - root.scrollTop) < 1) return;
      locked = true;
      root.scrollTo({
        top,
        behavior: reduceMotion.matches ? "auto" : "smooth",
      });
      // Fallback release in case `scrollend` never fires (older browsers or
      // an instant, sub-threshold scroll).
      if (lockTimer !== null) clearTimeout(lockTimer);
      lockTimer = setTimeout(releaseLock, LOCK_FALLBACK_MS);
    };

    const step = (delta: number): void => {
      if (locked) return;
      goTo(currentIndex() + delta);
    };

    const onWheel = (event: WheelEvent): void => {
      // Ctrl + wheel is reserved for zooming interactive scenes (e.g. the
      // cabin model), so let that gesture through instead of navigating.
      if (event.ctrlKey) return;
      event.preventDefault();

      // Every wheel event — including momentum/inertia — pushes back the
      // re-arm point, so the deck only accepts a new gesture once scrolling
      // has fully stopped for WHEEL_IDLE_MS.
      if (idleTimer !== null) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        armed = true;
      }, WHEEL_IDLE_MS);

      if (locked || !armed || Math.abs(event.deltaY) < WHEEL_THRESHOLD) return;
      armed = false;
      step(event.deltaY > 0 ? 1 : -1);
    };

    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target)) return;
      switch (event.key) {
        case "ArrowDown":
        case "PageDown":
        case " ":
          event.preventDefault();
          step(1);
          break;
        case "ArrowUp":
        case "PageUp":
          event.preventDefault();
          step(-1);
          break;
        case "Home":
          event.preventDefault();
          goTo(0);
          break;
        case "End":
          event.preventDefault();
          goTo(slideCount - 1);
          break;
        default:
          break;
      }
    };

    let touchStartY: number | null = null;

    const onTouchStart = (event: TouchEvent): void => {
      touchStartY = event.touches[0]?.clientY ?? null;
    };

    const onTouchMove = (event: TouchEvent): void => {
      // Suppress native scroll so the deck moves as discrete slides.
      event.preventDefault();
    };

    const onTouchEnd = (event: TouchEvent): void => {
      if (touchStartY === null || locked) {
        touchStartY = null;
        return;
      }
      const endY = event.changedTouches[0]?.clientY ?? touchStartY;
      const delta = touchStartY - endY;
      touchStartY = null;
      if (Math.abs(delta) < TOUCH_THRESHOLD) return;
      step(delta > 0 ? 1 : -1);
    };

    const onScrollEnd = (): void => releaseLock();

    root.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchmove", onTouchMove, { passive: false });
    root.addEventListener("touchend", onTouchEnd);
    root.addEventListener("scrollend", onScrollEnd);

    return () => {
      root.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("touchmove", onTouchMove);
      root.removeEventListener("touchend", onTouchEnd);
      root.removeEventListener("scrollend", onScrollEnd);
      if (lockTimer !== null) clearTimeout(lockTimer);
      if (idleTimer !== null) clearTimeout(idleTimer);
    };
  }, [scrollRootId, slideCount]);

  return null;
}
