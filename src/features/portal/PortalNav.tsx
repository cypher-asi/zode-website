"use client";

import type { ReactElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./shell.module.css";

const SECTIONS = [
  {
    href: "/portal",
    label: "Home",
    exact: true,
    glyph: <path d="M3 9.25 10 3.25l7 6M4.75 7.75v8.5a.5.5 0 0 0 .5.5h3.25v-4.75h3v4.75h3.25a.5.5 0 0 0 .5-.5v-8.5" />,
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
    glyph: (
      <path d="M6.25 5.25h7.5a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1h-7.5a1 1 0 0 1-1-1v-7.5a1 1 0 0 1 1-1zM8.25 8.25h3.5v3.5h-3.5zM7.5 2.75v2.5M10 2.75v2.5M12.5 2.75v2.5M7.5 14.75v2.5M10 14.75v2.5M12.5 14.75v2.5M2.75 7.5h2.5M2.75 10h2.5M2.75 12.5h2.5M14.75 7.5h2.5M14.75 10h2.5M14.75 12.5h2.5" />
    ),
  },
  {
    href: "/portal/contracts",
    label: "Contracts",
    exact: false,
    glyph: <path d="M5.25 2.75h6.5l3.5 3.5v11h-10zM11.75 2.75v3.5h3.5M7.75 10.25h4.5M7.75 13.25h4.5" />,
  },
  {
    href: "/portal/settings",
    label: "Settings",
    exact: false,
    glyph: (
      <>
        <path d="M8.69 4.76L8.99 2.82A7.25 7.25 0 0 1 11.01 2.82L11.31 4.76A5.4 5.4 0 0 1 12.78 5.37L14.36 4.21A7.25 7.25 0 0 1 15.79 5.64L14.63 7.22A5.4 5.4 0 0 1 15.24 8.69L17.18 8.99A7.25 7.25 0 0 1 17.18 11.01L15.24 11.31A5.4 5.4 0 0 1 14.63 12.78L15.79 14.36A7.25 7.25 0 0 1 14.36 15.79L12.78 14.63A5.4 5.4 0 0 1 11.31 15.24L11.01 17.18A7.25 7.25 0 0 1 8.99 17.18L8.69 15.24A5.4 5.4 0 0 1 7.22 14.63L5.64 15.79A7.25 7.25 0 0 1 4.21 14.36L5.37 12.78A5.4 5.4 0 0 1 4.76 11.31L2.82 11.01A7.25 7.25 0 0 1 2.82 8.99L4.76 8.69A5.4 5.4 0 0 1 5.37 7.22L4.21 5.64A7.25 7.25 0 0 1 5.64 4.21L7.22 5.37A5.4 5.4 0 0 1 8.69 4.76z" />
        <circle cx="10" cy="10" r="2.25" />
      </>
    ),
  },
] as const;

/** Sections only ZODE admins see. */
const ADMIN_SECTIONS = [
  {
    href: "/portal/posts",
    label: "Posts",
    exact: false,
    glyph: <path d="M13.25 3.25 16.75 6.75 7.5 16H4v-3.5zM11.25 5.25l3.5 3.5M4 17.25h12" />,
  },
  {
    href: "/portal/subscribers",
    label: "Subscribers",
    exact: false,
    glyph: <path d="M3.25 5.25h13.5v9.5H3.25zM3.75 5.75 10 10.75l6.25-5" />,
  },
] as const;

/** The portal's sections as a column of desktop-style icons under the wordmark; a row on phones. */
export function PortalNav({ admin = false }: { admin?: boolean }): ReactElement {
  const pathname = usePathname() ?? "/portal";
  const sections = admin ? [...SECTIONS, ...ADMIN_SECTIONS] : SECTIONS;

  return (
    <nav className={styles.rail} aria-label="Portal">
      {sections.map((section) => {
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
