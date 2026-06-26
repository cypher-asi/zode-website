"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import styles from "./OverlayScrollbar.module.css";

interface OverlayScrollbarProps {
  /** Id of the scrollable element this bar should track. */
  readonly targetId: string;
  /** Minimum thumb height in px. */
  readonly minThumb?: number;
  /** Idle delay before the bar fades, in ms. */
  readonly hideDelay?: number;
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
  minThumb = 28,
  hideDelay = 1200,
}: OverlayScrollbarProps): ReactElement {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [scrollable, setScrollable] = useState(false);

  useEffect(() => {
    const el = document.getElementById(targetId);
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!el || !track || !thumb) return;

    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    let frame = 0;
    let dragging = false;

    const armHide = (): void => {
      if (hideTimer !== null) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        if (!dragging) setVisible(false);
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

    el.addEventListener("scroll", onScroll, { passive: true });
    thumb.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", schedule);

    render();
    // Flash the bar on mount so it reads as present, then fade.
    setVisible(true);
    armHide();

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      if (hideTimer !== null) clearTimeout(hideTimer);
      resize.disconnect();
      el.removeEventListener("scroll", onScroll);
      thumb.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("resize", schedule);
    };
  }, [targetId, minThumb, hideDelay]);

  return (
    <div
      ref={trackRef}
      className={`${styles.track}${visible && scrollable ? ` ${styles.visible}` : ""}`}
      aria-hidden="true"
    >
      <div ref={thumbRef} className={styles.thumb} />
    </div>
  );
}
