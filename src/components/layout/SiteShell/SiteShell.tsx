import type { ReactElement, ReactNode } from "react";
import { PinnedHeader } from "@/components/layout/PinnedHeader";
import { FooterReveal, FooterScene } from "@/components/layout/SiteFooter";
import styles from "./SiteShell.module.css";

/**
 * Shell for the secondary pages, matching the home page: the pinned wordmark
 * and Buy Compute menu over a light content area that scrolls with the
 * window, optionally closing with the home page's landscape footer.
 */
export function SiteShell({
  children,
  footer = true,
  fade = true,
  edge = "wide",
  nav,
}: {
  children: ReactNode;
  /** Set false to end at the content, e.g. on the account pages. */
  footer?: boolean;
  /** Set false when the content never scrolls under the header, e.g. the portal's fixed panel. */
  fade?: boolean;
  /**
   * "tight" tucks the header into the corners like the buy compute page, and
   * "flush" all but to the window's sides, for the portal's panels; it slides
   * there and back between pages.
   */
  edge?: "wide" | "tight" | "flush";
  /** Pinned navigation beside the content, e.g. the portal's icon rail. */
  nav?: ReactNode;
}): ReactElement {
  return (
    <div className={styles.shell} data-edge={edge}>
      <PinnedHeader />
      {nav}
      <main className={styles.main} data-surface="light">
        {fade ? (
          <div className={styles.fadeTrack} aria-hidden="true">
            <div className={styles.fade} data-top-fade-cover />
          </div>
        ) : null}
        <div>{children}</div>
      </main>
      {footer ? (
        <footer className={styles.footer} aria-label="Site footer" data-surface="dark">
          <FooterScene />
          <FooterReveal />
        </footer>
      ) : null}
    </div>
  );
}
