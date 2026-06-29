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

// The (site) layout scrolls inside this persistent container. Only smooth-
// scroll back to the top when the clicked link is the page we're already on
// (the route won't change, so ScrollReset won't fire). For navigations to a
// *different* page, ScrollReset snaps the incoming page to the top — smooth-
// scrolling there would animate the outgoing page upward while it's still
// mounted, flashing its hero video into view mid-transition.
function scrollSiteToTopIfCurrent(pathname: string, href: string): void {
  if (!isActive(pathname, href)) return;
  document
    .getElementById("site-scroll")
    ?.scrollTo({ top: 0, behavior: "smooth" });
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
        <Link
          className={styles.brand}
          href="/"
          aria-label="ZODE — home"
          onClick={() => scrollSiteToTopIfCurrent(pathname, "/")}
        >
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
            onClick={() => scrollSiteToTopIfCurrent(pathname, link.href)}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className={styles.trailing}>
        <Link className={styles.ghostButton} href="/give-compute">
          Give Compute
        </Link>
        <Link className={styles.ghostButton} href="/buy-compute">
          Buy Compute
        </Link>
      </div>
    </header>
  );
}
