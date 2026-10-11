import type { ReactNode } from "react";
import { display, text } from "@/lib/fonts";
import { FooterReveal } from "../(home)/footer/FooterReveal";
import { FooterScene } from "../(home)/footer/FooterScene";
import { PinnedHeader } from "../(home)/PinnedHeader";
import styles from "./SiteShell.module.css";

/**
 * Shell for the secondary pages, matching the home page: the pinned wordmark
 * and Buy Compute menu over a light content area that scrolls with the
 * window, closing with the home page's landscape footer.
 */
export default function SiteLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className={`${styles.shell} ${display.variable} ${text.variable}`}>
      <PinnedHeader />
      <main className={styles.main} data-surface="light">
        {/* Only the content fades under the header; the white background stays solid. */}
        <div data-top-fade>{children}</div>
      </main>
      <footer className={styles.footer} aria-label="Site footer" data-surface="dark">
        <FooterScene />
        <FooterReveal />
      </footer>
    </div>
  );
}
