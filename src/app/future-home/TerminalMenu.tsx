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
 * gets a return-key marker.
 */
export function TerminalMenu(): ReactElement {
  return (
    <nav className={styles.menu} aria-label="Get started" onKeyDown={onMenuKey}>
      <ul className={styles.items}>
        {ACTIONS.map((action) => (
          <li key={action.href}>
            <Link className={styles.item} href={action.href}>
              <svg
                className={styles.enter}
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M13 3v4.5a2 2 0 0 1-2 2H3.5M6.5 6.5l-3 3 3 3" />
              </svg>
              {action.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
