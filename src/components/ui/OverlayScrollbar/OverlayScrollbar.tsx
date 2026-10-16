"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import styles from "./OverlayScrollbar.module.css";

interface OverlayScrollbarProps {
  /** Id of the scrollable element this bar should track. */
  readonly targetId?: string;
  /** The scrollable element itself, for one that has no id or is swapped out; wins over `targetId`. */
  readonly target?: HTMLElement | null;
  /** Minimum thumb height in px. */
  readonly minThumb?: number;
  /** Idle delay before the bar fades, in ms. */
  readonly hideDelay?: number;
  /** Also show the bar for as long as the pointer is over the scroll area. */
  readonly showOnHover?: boolean;
}

/**
 * A custom scrollbar that floats over the content of a scroll container
 * rather than reserving gutter space. Native scrollbars on Windows always
 * consume width and CSS `overflow: overlay` is no longer honored, so we draw
 * our own: it mirrors the target's scroll position, supports drag-to-scroll,
 * and auto-hides when idle. Renders into the target's positioned parent.
 */
export function OverlayScrollbar({
  targetId,
  target,
  minThumb = 28,
  hideDelay = 1200,
  showOnHover = false,
}: OverlayScrollbarProps): ReactElement {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [scrollable, setScrollable] = useState(false);

  useEffect(() => {
    const el = target ?? (targetId ? document.getElementById(targetId) : null);
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!el || !track || !thumb) return;

    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    let frame = 0;
    let dragging = false;
    let hovering = false;

    const armHide = (): void => {
      if (hideTimer !== null) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        if (!dragging && !hovering) setVisible(false);
      }, hideDelay);
    };

    const render = (): void => {
      frame = 0;
      const viewport = el.clientHeight;
      const content = el.scrollHeight;
      const maxScroll = content - viewport;
      const canScroll = maxScroll > 1;
      setScrollable(canScroll);
      if (!canScroll) return;
      const trackH = track.clientHeight;
      const thumbH = Math.max(minThumb, (viewport / content) * trackH);
      const maxThumbTop = trackH - thumbH;
      const top = (el.scrollTop / maxScroll) * maxThumbTop;
      thumb.style.height = `${thumbH}px`;
      thumb.style.transform = `translateY(${top}px)`;
    };

    const schedule = (): void => {
      if (frame === 0) frame = requestAnimationFrame(render);
    };

    const onScroll = (): void => {
      schedule();
      setVisible(true);
      armHide();
    };

    let dragStartY = 0;
    let dragStartScroll = 0;

    const onPointerMove = (event: PointerEvent): void => {
      if (!dragging) return;
      const viewport = el.clientHeight;
      const content = el.scrollHeight;
      const maxScroll = content - viewport;
      const trackH = track.clientHeight;
      const thumbH = Math.max(minThumb, (viewport / content) * trackH);
      const maxThumbTop = trackH - thumbH;
      if (maxThumbTop <= 0) return;
      const delta = event.clientY - dragStartY;
      el.scrollTop = dragStartScroll + (delta / maxThumbTop) * maxScroll;
    };

    const onPointerUp = (event: PointerEvent): void => {
      dragging = false;
      thumb.releasePointerCapture?.(event.pointerId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      armHide();
    };

    const onPointerDown = (event: PointerEvent): void => {
      dragging = true;
      dragStartY = event.clientY;
      dragStartScroll = el.scrollTop;
      thumb.setPointerCapture?.(event.pointerId);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      setVisible(true);
      event.preventDefault();
    };

    const resize = new ResizeObserver(schedule);
    resize.observe(el);
    for (const child of Array.from(el.children)) resize.observe(child);
    // Children added later (rows of an expanded list) change the content height without resizing anything observed.
    const mutations = new MutationObserver(schedule);
    mutations.observe(el, { childList: true });

    // The bar's own track sits outside the target, so hovering the thumb counts via the shared parent.
    const area = el.parentElement ?? el;
    const onPointerEnter = (): void => {
      hovering = true;
      schedule();
      setVisible(true);
    };
    const onPointerLeave = (): void => {
      hovering = false;
      armHide();
    };
    if (showOnHover) {
      area.addEventListener("pointerenter", onPointerEnter);
      area.addEventListener("pointerleave", onPointerLeave);
    }

    el.addEventListener("scroll", onScroll, { passive: true });
    thumb.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", schedule);

    render();
    // Flash the bar on mount so it reads as present, then fade; hover mode shows it when it's wanted instead.
    const flash = showOnHover
      ? 0
      : requestAnimationFrame(() => {
          setVisible(true);
          armHide();
        });

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      if (flash !== 0) cancelAnimationFrame(flash);
      if (hideTimer !== null) clearTimeout(hideTimer);
      resize.disconnect();
      mutations.disconnect();
      area.removeEventListener("pointerenter", onPointerEnter);
      area.removeEventListener("pointerleave", onPointerLeave);
      el.removeEventListener("scroll", onScroll);
      thumb.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("resize", schedule);
    };
  }, [targetId, target, minThumb, hideDelay, showOnHover]);

  return (
    <div
      ref={trackRef}
      className={`${styles.track}${visible && scrollable ? ` ${styles.visible}` : ""}`}
      data-overlay-scrollbar=""
      aria-hidden="true"
    >
      <div ref={thumbRef} className={styles.thumb} />
    </div>
  );
}
