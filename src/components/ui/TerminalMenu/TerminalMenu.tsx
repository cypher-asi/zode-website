"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import { useOnScreen } from "@/hooks/useOnScreen";
import styles from "./TerminalMenu.module.css";

export interface TerminalMenuItem {
  id: string;
  label: string;
  /** Renders the row as a link; rows without one are buttons that report through `onSelect`. */
  href?: string;
  /** Set false to keep the scroll position, e.g. for a link that opens a modal. */
  scroll?: boolean;
}

export interface TerminalMenuProps {
  items: readonly TerminalMenuItem[];
  /** Accessible name for the menu. */
  label: string;
  /**
   * Row that shows the caret and cursor while nothing in the menu is hovered
   * or focused. Defaults to the first row; `null` leaves every row at rest.
   */
  current?: string | null;
  /** Chosen option: stays in full ink while the caret moves and is exposed as pressed. */
  selected?: string;
  size?: "md" | "sm";
  onSelect?: (id: string) => void;
  /** Reports the row under the pointer or keyboard focus, then `null` once both leave the menu. */
  onHighlight?: (id: string | null) => void;
  /** Types the rows in one after another when the menu mounts, like the footer menu. */
  typeIn?: boolean;
  /** Extra class on the root, e.g. for spacing or to retint `--ink` / `--muted` on a dark surface. */
  className?: string;
}

/** Moves focus between the rows with the arrow keys, wrapping at the ends. */
function onMenuKey(event: KeyboardEvent<HTMLElement>): void {
  const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
  if (!step) return;

  const rows = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(`.${styles.item}`));
  const at = rows.indexOf(document.activeElement as HTMLElement);
  const next = at === -1 ? (step > 0 ? 0 : rows.length - 1) : (at + step + rows.length) % rows.length;

  event.preventDefault();
  rows[next]?.focus();
}

/**
 * Terminal-style picker shared by the home page sections: the hovered or
 * focused row, or `current` while the menu is idle, gets a caret and a
 * blinking block cursor. Rows are links for navigation or buttons for
 * in-page choices such as switching the pod on display.
 */
export function TerminalMenu({
  items,
  label,
  current = items[0]?.id ?? null,
  selected,
  size = "md",
  onSelect,
  onHighlight,
  typeIn = false,
  className,
}: TerminalMenuProps): ReactElement {
  const navigates = items.some((item) => item.href);
  const Root = navigates ? "nav" : "div";
  const rootRef = useRef<HTMLElement>(null);
  const [typing, setTyping] = useState(typeIn);
  const onScreen = useOnScreen(rootRef);

  /*
   * The typing runs in CSS from first paint, so it may finish before
   * hydration; waiting on the animations themselves covers both cases. Until
   * then the `current` row stays at rest so its caret doesn't sit on a blank line.
   */
  useEffect(() => {
    const root = rootRef.current;
    if (!typing || !root) return;

    let live = true;
    const done = () => {
      if (live) setTyping(false);
    };
    const runs = Array.from(root.querySelectorAll(`.${styles.text}`)).flatMap((node) =>
      node.getAnimations(),
    );
    Promise.all(runs.map((run) => run.finished)).then(done, done);
    return () => {
      live = false;
    };
  }, [typing]);

  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) onHighlight?.(null);
  };

  return (
    <Root
      ref={(node: HTMLElement | null) => {
        rootRef.current = node;
      }}
      className={className ? `${styles.menu} ${className}` : styles.menu}
      role={navigates ? undefined : "group"}
      aria-label={label}
      data-size={size}
      data-typing={typing || undefined}
      data-offscreen={!onScreen || undefined}
      onKeyDown={onMenuKey}
      onMouseLeave={onHighlight && (() => onHighlight(null))}
      onBlur={onHighlight && onBlur}
    >
      <ul className={styles.items}>
        {items.map((item, i) => {
          const row = {
            className: styles.item,
            style: { "--i": i, "--chars": item.label.length } as CSSProperties,
            "data-current": item.id === current || undefined,
            "data-selected": item.id === selected || undefined,
            onMouseEnter: onHighlight && (() => onHighlight(item.id)),
            onFocus: onHighlight && (() => onHighlight(item.id)),
          };
          const content = (
            <>
              <span className={styles.caret} aria-hidden="true">
                &gt;
              </span>
              <span className={styles.text}>{item.label}</span>
              <span className={styles.cursor} aria-hidden="true" />
            </>
          );
          return (
            <li key={item.id}>
              {item.href ? (
                <Link {...row} href={item.href} scroll={item.scroll}>
                  {content}
                </Link>
              ) : (
                <button
                  {...row}
                  type="button"
                  aria-pressed={selected === undefined ? undefined : item.id === selected}
                  onClick={() => onSelect?.(item.id)}
                >
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Root>
  );
}
