"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import styles from "./OverlayScrollbar.module.css";

interface OverlayScrollbarProps {
  /** Id of the scrollable element this bar should track. */
  readonly targetId?: string;
  /** The scrollable element itself, for one that has no id or is swapped out; wins over `targetId`. */
  readonly target?: HTMLElement | null;
  /** Which way the bar scrolls: down the right edge, or along the bottom. */
  readonly axis?: "y" | "x";
  /** Minimum thumb length in px. */
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
  axis = "y",
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
    const horizontal = axis === "x";

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

    const measure = () => {
      const viewport = horizontal ? el.clientWidth : el.clientHeight;
      const content = horizontal ? el.scrollWidth : el.scrollHeight;
      const trackLength = horizontal ? track.clientWidth : track.clientHeight;
      const thumbLength = Math.max(minThumb, (viewport / content) * trackLength);
      return { maxScroll: content - viewport, thumbLength, maxThumbOffset: trackLength - thumbLength };
    };

    const render = (): void => {
      frame = 0;
      const { maxScroll, thumbLength, maxThumbOffset } = measure();
      const canScroll = maxScroll > 1;
      setScrollable(canScroll);
      if (!canScroll) return;
      const offset = ((horizontal ? el.scrollLeft : el.scrollTop) / maxScroll) * maxThumbOffset;
      if (horizontal) {
        thumb.style.width = `${thumbLength}px`;
        thumb.style.transform = `translateX(${offset}px)`;
      } else {
        thumb.style.height = `${thumbLength}px`;
        thumb.style.transform = `translateY(${offset}px)`;
      }
    };

    const schedule = (): void => {
      if (frame === 0) frame = requestAnimationFrame(render);
    };

    const onScroll = (): void => {
      schedule();
      setVisible(true);
      armHide();
    };

    let dragStart = 0;
    let dragStartScroll = 0;

    const onPointerMove = (event: PointerEvent): void => {
      if (!dragging) return;
      const { maxScroll, maxThumbOffset } = measure();
      if (maxThumbOffset <= 0) return;
      const delta = (horizontal ? event.clientX : event.clientY) - dragStart;
      const scroll = dragStartScroll + (delta / maxThumbOffset) * maxScroll;
      if (horizontal) el.scrollLeft = scroll;
      else el.scrollTop = scroll;
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
      dragStart = horizontal ? event.clientX : event.clientY;
      dragStartScroll = horizontal ? el.scrollLeft : el.scrollTop;
      thumb.setPointerCapture?.(event.pointerId);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      setVisible(true);
      event.preventDefault();
    };

    const resize = new ResizeObserver(schedule);
    resize.observe(el);
    for (const child of Array.from(el.children)) resize.observe(child);
    // Children added later (rows of an expanded list, a document once it loads) change the
    // content's size without resizing anything observed, and may resize again themselves.
    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of Array.from(record.addedNodes)) if (node instanceof Element) resize.observe(node);
      }
      schedule();
    });
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
  }, [targetId, target, axis, minThumb, hideDelay, showOnHover]);

  return (
    <div
      ref={trackRef}
      className={`${styles.track}${axis === "x" ? ` ${styles.horizontal}` : ""}${visible && scrollable ? ` ${styles.visible}` : ""}`}
      data-overlay-scrollbar=""
      aria-hidden="true"
    >
      <div ref={thumbRef} className={styles.thumb} />
    </div>
  );
}
