"use client";

import type { ReactElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./SiteNav.module.css";

interface NavLink {
  readonly href: string;
  readonly label: string;
}

const NAV_LINKS: readonly NavLink[] = [
  { href: "/", label: "Product" },
  { href: "/network", label: "Network" },
  { href: "/invest", label: "Invest" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Global top navigation on the constant white shell: a "Give compute"
 * button on the left, the primary section links centered, and a primary
 * "Buy compute" button on the right.
 */
export function SiteNav(): ReactElement {
  const pathname = usePathname() ?? "/";

  return (
    <header className={styles.nav}>
      <div className={styles.leading}>
        <Link className={styles.brand} href="/" aria-label="ZODE — home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.wordmark} src="/wordmark.png" alt="" aria-hidden="true" />
        </Link>
      </div>

      <nav className={styles.links} aria-label="Primary">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={styles.link}
            aria-current={isActive(pathname, link.href) ? "page" : undefined}
            data-active={isActive(pathname, link.href) ? "" : undefined}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className={styles.trailing}>
        <Link className={styles.ghostButton} href="/give-compute">
          Give compute
        </Link>
        <Link className={styles.primaryButton} href="/buy-compute">
          Buy compute
        </Link>
      </div>
    </header>
  );
}
