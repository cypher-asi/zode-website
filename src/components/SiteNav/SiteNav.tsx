"use client";

import { useId, useState, type ReactElement } from "react";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  // Collapse the mobile menu whenever the route changes so it never lingers
  // open over a freshly navigated page. Adjusting state during render (the
  // React-recommended pattern) avoids an extra effect pass.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMenuOpen(false);
  }

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

      <button
        type="button"
        className={styles.menuButton}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        aria-controls={menuId}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span className={styles.menuIcon} data-open={menuOpen ? "" : undefined} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>

      <div
        id={menuId}
        className={styles.menuPanel}
        data-open={menuOpen ? "" : undefined}
        hidden={!menuOpen}
      >
        <nav className={styles.menuLinks} aria-label="Primary mobile">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={styles.menuLink}
              aria-current={isActive(pathname, link.href) ? "page" : undefined}
              data-active={isActive(pathname, link.href) ? "" : undefined}
              onClick={() => {
                scrollSiteToTopIfCurrent(pathname, link.href);
                setMenuOpen(false);
              }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className={styles.menuActions}>
          <Link
            className={styles.menuGhostButton}
            href="/give-compute"
            onClick={() => setMenuOpen(false)}
          >
            Give Compute
          </Link>
          <Link
            className={styles.menuGhostButton}
            href="/buy-compute"
            onClick={() => setMenuOpen(false)}
          >
            Buy Compute
          </Link>
        </div>
      </div>
    </header>
  );
}
