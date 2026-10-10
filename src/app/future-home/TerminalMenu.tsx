"use client";

import Link from "next/link";
import type { KeyboardEvent, ReactElement } from "react";
import styles from "./TerminalMenu.module.css";

const ACTIONS = [
  { label: "Deploy Compute", href: "/deployments" },
  { label: "Buy Compute", href: "/buy-compute" },
  { label: "Learn More", href: "#learn-more" },
];

/** Moves focus between the menu's links with the arrow keys, wrapping at the ends. */
function onMenuKey(event: KeyboardEvent<HTMLElement>): void {
  const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
  if (!step) return;

  const links = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>("a"));
  const current = links.indexOf(document.activeElement as HTMLAnchorElement);
  const next = current === -1 ? (step > 0 ? 0 : links.length - 1) : (current + step + links.length) % links.length;

  event.preventDefault();
  links[next]?.focus();
}

/**
 * Hero call-to-action styled as a terminal picker: the hovered or focused row
 * gets a caret and a blinking block cursor.
 */
export function TerminalMenu(): ReactElement {
  return (
    <nav className={styles.menu} aria-label="Get started" onKeyDown={onMenuKey}>
      <ul className={styles.items}>
        {ACTIONS.map((action) => (
          <li key={action.href}>
            <Link className={styles.item} href={action.href}>
              <span className={styles.caret} aria-hidden="true">
                &gt;
              </span>
              {action.label}
              <span className={styles.cursor} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
