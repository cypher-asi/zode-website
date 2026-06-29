"use client";

import type { ReactElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./SiteFooter.module.css";

// Scroll containers used by the two shells the footer renders inside:
// the (site) layout and the invest OuterShell.
const SCROLL_ROOT_IDS = ["site-scroll", "grid-scroll"] as const;

// When a footer link points at the page we're already on, the route won't
// change (so no navigation/scroll reset fires). Smooth-scroll the active
// shell's scroll container back to the top instead.
function scrollToTopIfCurrent(pathname: string, href: string): void {
  if (href !== pathname) return;
  for (const id of SCROLL_ROOT_IDS) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
  }
}

interface FooterLink {
  readonly label: string;
  readonly href: string;
  readonly external?: boolean;
}

interface FooterColumn {
  readonly heading: string;
  readonly links: readonly FooterLink[];
}

// Toggle the X / LinkedIn social row. Kept off until real profile links exist;
// set to true to bring the icons back in their original footer position.
const SOCIAL_LINKS_READY = false;

const COLUMNS: readonly FooterColumn[] = [
  {
    heading: "Product",
    links: [{ label: "Overview", href: "/" }],
  },
  {
    heading: "Network",
    links: [
      { label: "THE GRID", href: "/network" },
      {
        label: "Whitepaper",
        href: "https://cypher.net/research/the-grid",
        external: true,
      },
    ],
  },
  {
    heading: "Invest",
    links: [
      { label: "Learn More", href: "/invest" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    heading: "Compute",
    links: [
      { label: "Buy compute", href: "/buy-compute" },
      { label: "Give compute", href: "/give-compute" },
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

function XIcon(): ReactElement {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

function LinkedInIcon(): ReactElement {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286ZM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065Zm1.782 13.019H3.555V9h3.564v11.452ZM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003Z" />
    </svg>
  );
}

/**
 * Site-wide marketing footer: uppercase section headers with link lists, a
 * large faded ZODE wordmark centered behind the columns, social links, and a
 * copyright line. Rendered at the end of the scrollable content area in each
 * shell so it appears on every gated page.
 */
// Routes whose page provides its own full-height layout and should not
// render the shared site footer below the fold.
const HIDDEN_FOOTER_ROUTES = ["/buy-compute", "/give-compute"] as const;

export function SiteFooter(): ReactElement | null {
  const pathname = usePathname() ?? "/";

  if (HIDDEN_FOOTER_ROUTES.includes(pathname as (typeof HIDDEN_FOOTER_ROUTES)[number])) {
    return null;
  }

  return (
    <footer className={styles.footer} aria-label="Site footer">
      {/* Decorative watermark: ships white on transparency and inverts to match
          the surface via the shared --logo-invert token. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.brandMark} src="/wordmark.png" alt="" aria-hidden="true" />

      <div className={styles.inner}>
        <nav className={styles.columns} aria-label="Footer navigation">
          {COLUMNS.map((column) => (
            <div key={column.heading} className={styles.column}>
              <h2 className={styles.heading}>{column.heading}</h2>
              <ul className={styles.links}>
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        className={styles.link}
                        href={link.href}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        className={styles.link}
                        href={link.href}
                        onClick={() => scrollToTopIfCurrent(pathname, link.href)}
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className={styles.bottom}>
          {/* Social links are hidden until real destinations are ready; flip
              SOCIAL_LINKS_READY to true to restore them in place. */}
          {SOCIAL_LINKS_READY ? (
            <div className={styles.social}>
              <a
                className={styles.socialLink}
                href="https://x.com/zode_org"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="ZODE on X"
              >
                <XIcon />
              </a>
              <a
                className={styles.socialLink}
                href="#"
                aria-label="ZODE on LinkedIn"
              >
                <LinkedInIcon />
              </a>
            </div>
          ) : null}
          <p className={styles.copyright}>Copyright &copy; 2026 Cypher, Inc.</p>
        </div>
      </div>
    </footer>
  );
}
