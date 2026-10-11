"use client";

import Link from "next/link";
import type { FocusEvent, KeyboardEvent, ReactElement } from "react";
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
  className,
}: TerminalMenuProps): ReactElement {
  const navigates = items.some((item) => item.href);
  const Root = navigates ? "nav" : "div";

  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) onHighlight?.(null);
  };

  return (
    <Root
      className={className ? `${styles.menu} ${className}` : styles.menu}
      role={navigates ? undefined : "group"}
      aria-label={label}
      data-size={size}
      onKeyDown={onMenuKey}
      onMouseLeave={onHighlight && (() => onHighlight(null))}
      onBlur={onHighlight && onBlur}
    >
      <ul className={styles.items}>
        {items.map((item) => {
          const row = {
            className: styles.item,
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
              {item.label}
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
