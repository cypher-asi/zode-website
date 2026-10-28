"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
  type PointerEvent,
  type ReactElement,
} from "react";
import styles from "./InfoTip.module.css";

/** A line of the tip: a label with text, or with a moment shown as a date and time in the viewer's timezone. */
export type InfoTipRow = { label: string } & ({ value: string } | { date: Date | string });

export interface InfoTipProps {
  rows: readonly InfoTipRow[];
  /** Accessible name of the icon, e.g. "Invite details". */
  label: string;
  /**
   * For an icon inside a link, which can't hold another control: the icon
   * isn't focusable, and the link should name this id in `aria-describedby`.
   */
  id?: string;
  className?: string;
}

const GAP = 6;
const EDGE = 8;
const HIDE_DELAY_MS = 120;

const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

const noop = () => () => {};

/**
 * A small "i" that shows a few labelled facts on hover, focus or tap. The tip
 * sits in the top layer (Popover API), so list rows and dialogs can't clip it.
 */
export function InfoTip({ rows, label, id, className }: InfoTipProps): ReactElement {
  const autoId = useId();
  const tipId = id ?? `${autoId}-tip`;
  const nested = id !== undefined;
  const triggerRef = useRef<HTMLSpanElement & HTMLButtonElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const hovering = useRef(false);
  const [open, setOpen] = useState(false);
  // Dates format on the client only, in the viewer's timezone, so the server's can't leak into the markup.
  const client = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const tip = tipRef.current;
    if (!trigger || !tip) return;
    const rect = trigger.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const { offsetWidth: width, offsetHeight: height } = tip;
    const up = rect.top - GAP - height >= EDGE;
    const left = Math.max(EDGE, Math.min(rect.left + rect.width / 2 - width / 2, vw - EDGE - width));
    tip.style.left = `${left}px`;
    tip.style.top = `${up ? rect.top - GAP - height : rect.bottom + GAP}px`;
    tip.dataset.side = up ? "top" : "bottom";
  }, []);

  const show = useCallback(() => {
    window.clearTimeout(hideTimer.current);
    const tip = tipRef.current;
    if (!tip || tip.matches(":popover-open")) return;
    tip.showPopover();
    place();
    setOpen(true);
  }, [place]);

  const hide = useCallback(() => {
    window.clearTimeout(hideTimer.current);
    hovering.current = false;
    tipRef.current?.hidePopover();
    setOpen(false);
  }, []);

  const hideSoon = () => {
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(hide, HIDE_DELAY_MS);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: globalThis.PointerEvent) => {
      if (!triggerRef.current?.contains(event.target as Node)) hide();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    window.addEventListener("scroll", place, { capture: true, passive: true });
    window.addEventListener("resize", place);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", place, { capture: true });
      window.removeEventListener("resize", place);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, place, hide]);

  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  const onPointerEnter = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    hovering.current = true;
    show();
  };
  const onPointerLeave = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    hovering.current = false;
    hideSoon();
  };
  // A tap toggles, since touch has no hover; inside a link it mustn't follow the link.
  const onClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!open) show();
    else if (!hovering.current) hide();
  };

  const icon = (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 7.25v4" />
      <circle cx="8" cy="4.9" r="0.4" />
    </svg>
  );
  const triggerClass = className ? `${styles.trigger} ${className}` : styles.trigger;
  const handlers = { onPointerEnter, onPointerLeave, onClick };

  return (
    <>
      {nested ? (
        <span ref={triggerRef} className={triggerClass} aria-hidden="true" {...handlers}>
          {icon}
        </span>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          className={triggerClass}
          aria-label={label}
          aria-describedby={tipId}
          aria-expanded={open}
          onFocus={(event) => {
            if (event.currentTarget.matches(":focus-visible")) show();
          }}
          onBlur={hide}
          {...handlers}
        >
          {icon}
        </button>
      )}
      {/* Spans throughout, since the tip may sit inside a link or a line of text. */}
      <span
        ref={tipRef}
        id={tipId}
        className={styles.tip}
        popover="manual"
        role="tooltip"
        onPointerEnter={() => window.clearTimeout(hideTimer.current)}
        onPointerLeave={hideSoon}
      >
        {client
          ? rows.map((row) => (
              <span key={row.label} className={styles.row}>
                <span className={styles.label}>{row.label}</span>
                <span className={styles.value}>{"date" in row ? when.format(new Date(row.date)) : row.value}</span>
              </span>
            ))
          : null}
      </span>
    </>
  );
}
