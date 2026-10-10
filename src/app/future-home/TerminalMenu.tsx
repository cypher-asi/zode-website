"use client";

import Link from "next/link";
import type { KeyboardEvent, ReactElement } from "react";
import styles from "./TerminalMenu.module.css";

const ACTIONS = [
  { label: "Deploy Compute", href: "/deployments", cmd: "./deploy" },
  { label: "Buy Compute", href: "/buy-compute", cmd: "./buy" },
  { label: "Learn More", href: "#learn-more", cmd: "man zode" },
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
 * Hero call-to-action styled as a terminal picker: a shell prompt over
 * numbered rows, with the hovered or focused row inverted and a blinking
 * block cursor after its label.
 */
export function TerminalMenu(): ReactElement {
  return (
    <nav className={styles.menu} aria-label="Get started" onKeyDown={onMenuKey}>
      <p className={styles.prompt} aria-hidden="true">
        zode@sovereign:~$ <span>select --action</span>
      </p>
      <ol className={styles.items}>
        {ACTIONS.map((action, n) => (
          <li key={action.href}>
            <Link className={styles.item} href={action.href}>
              <span className={styles.caret} aria-hidden="true">
                &gt;
              </span>
              <span className={styles.index} aria-hidden="true">
                {String(n + 1).padStart(2, "0")}
              </span>
              <span className={styles.label}>
                {action.label}
                <span className={styles.cursor} aria-hidden="true" />
              </span>
              <span className={styles.cmd} aria-hidden="true">
                {action.cmd}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
