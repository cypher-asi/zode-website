import type { ReactElement, ReactNode } from "react";
import { display, text } from "@/lib/fonts";
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
}: {
  children: ReactNode;
  /** Set false to end at the content, e.g. on the account pages. */
  footer?: boolean;
}): ReactElement {
  return (
    <div className={`${styles.shell} ${display.variable} ${text.variable}`}>
      <PinnedHeader />
      <main className={styles.main} data-surface="light">
        {/* Only the content fades under the header; the white background stays solid. */}
        <div data-top-fade>{children}</div>
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
