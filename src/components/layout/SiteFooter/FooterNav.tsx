"use client";

import type { CSSProperties, KeyboardEvent, ReactElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RESOURCE_LINKS, type NavLink } from "@/lib/navigation";
import styles from "./FooterNav.module.css";

interface FooterColumn {
  readonly heading: string;
  readonly links: readonly NavLink[];
}

const COLUMNS: readonly FooterColumn[] = [
  {
    heading: "Compute",
    links: [
      { label: "Buy compute", href: "/buy-compute" },
      { label: "Rent compute", href: "/buy-compute?mode=rent" },
    ],
  },
  { heading: "Resources", links: RESOURCE_LINKS },
  {
    heading: "Account",
    links: [
      { label: "Portal", href: "/portal" },
      { label: "Login", href: "/login" },
      { label: "Register", href: "/register" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

/** Every heading and link is one typed line, numbered column by column; this is each heading's number. */
const COLUMN_START = COLUMNS.map((_, c) =>
  COLUMNS.slice(0, c).reduce((n, column) => n + 1 + column.links.length, 0),
);
const LINE_COUNT = COLUMN_START.at(-1)! + 1 + COLUMNS.at(-1)!.links.length;

/** Position in the typing order and length, which drive the per-line timing in CSS. */
const line = (index: number, text: string) =>
  ({ "--i": index, "--chars": text.length }) as CSSProperties;

/** Moves focus between all the links with the arrow keys, wrapping at the ends. */
function onNavKey(event: KeyboardEvent<HTMLElement>): void {
  const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
  if (!step) return;

  const links = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(`.${styles.link}`));
  const at = links.indexOf(document.activeElement as HTMLElement);
  const next = at === -1 ? (step > 0 ? 0 : links.length - 1) : (at + step + links.length) % links.length;

  event.preventDefault();
  links[next]?.focus();
}

export interface FooterNavProps {
  /** Types the lines in one after another; going false erases them in reverse. */
  open: boolean;
}

/**
 * The site's link columns, revealed by the footer's MENU button as a
 * terminal-style menu: each line types in behind a block cursor, and the
 * hovered or focused link gets a caret and a blinking cursor.
 */
export function FooterNav({ open }: FooterNavProps): ReactElement {
  const pathname = usePathname() ?? "/";

  return (
    <nav
      className={styles.columns}
      aria-label="Footer navigation"
      data-open={open || undefined}
      style={{ "--n": LINE_COUNT } as CSSProperties}
      onKeyDown={onNavKey}
    >
      {COLUMNS.map((column, c) => (
        <div key={column.heading} className={styles.column}>
          <h2 className={styles.heading} style={line(COLUMN_START[c], column.heading)}>
            <span className={styles.text}>{column.heading}</span>
            <span className={styles.cursor} aria-hidden="true" />
          </h2>
          <ul className={styles.links}>
            {column.links.map((link, l) => {
              const i = COLUMN_START[c] + 1 + l;
              const row = {
                className: styles.link,
                style: line(i, link.label),
                "data-last": i === LINE_COUNT - 1 || undefined,
              };
              const content = (
                <>
                  <span className={styles.caret} aria-hidden="true">
                    &gt;
                  </span>
                  <span className={styles.text}>{link.label}</span>
                  <span className={styles.cursor} aria-hidden="true" />
                </>
              );
              return (
                <li key={link.label}>
                  {link.external ? (
                    <a {...row} href={link.href} target="_blank" rel="noreferrer noopener">
                      {content}
                    </a>
                  ) : (
                    <Link
                      {...row}
                      href={link.href}
                      // Same-page links don't navigate, so scroll back up instead.
                      onClick={() => {
                        if (link.href === pathname) window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      {content}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
