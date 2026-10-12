"use client";

import type { ReactElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./shell.module.css";

const SECTIONS = [
  {
    href: "/portal",
    label: "Dashboard",
    exact: true,
    glyph: (
      <>
        <rect x="3" y="3" width="5.5" height="5.5" rx="1.5" />
        <rect x="11.5" y="3" width="5.5" height="5.5" rx="1.5" />
        <rect x="3" y="11.5" width="5.5" height="5.5" rx="1.5" />
        <rect x="11.5" y="11.5" width="5.5" height="5.5" rx="1.5" />
      </>
    ),
  },
  {
    href: "/portal/data-rooms",
    label: "Data rooms",
    exact: false,
    glyph: <path d="M2.75 6A1.75 1.75 0 0 1 4.5 4.25h3.1l1.8 2h6.1A1.75 1.75 0 0 1 17.25 8v6.25A1.75 1.75 0 0 1 15.5 16h-11a1.75 1.75 0 0 1-1.75-1.75z" />,
  },
  {
    href: "/portal/orders",
    label: "Orders",
    exact: false,
    glyph: <path d="M10 2.75 16.75 6.4v7.2L10 17.25 3.25 13.6V6.4zM3.25 6.4 10 10.05l6.75-3.65M10 10.05v7.2" />,
  },
  {
    href: "/portal/contracts",
    label: "Contracts",
    exact: false,
    glyph: <path d="M5.25 2.75h6.5l3.5 3.5v11h-10zM11.75 2.75v3.5h3.5M7.75 10.25h4.5M7.75 13.25h4.5" />,
  },
] as const;

/** The portal's sections as a column of desktop-style icons under the wordmark; a row on phones. */
export function PortalNav(): ReactElement {
  const pathname = usePathname() ?? "/portal";

  return (
    <nav className={styles.rail} aria-label="Portal">
      {SECTIONS.map((section) => {
        const active = section.exact
          ? pathname === section.href
          : pathname === section.href || pathname.startsWith(`${section.href}/`);
        return (
          <Link
            key={section.href}
            href={section.href}
            className={styles.item}
            aria-current={active ? "page" : undefined}
          >
            <span className={styles.tile}>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                {section.glyph}
              </svg>
            </span>
            <span className={styles.label}>{section.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
