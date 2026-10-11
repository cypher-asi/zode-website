import type { ReactNode } from "react";
import { display, text } from "@/lib/fonts";
import { PinnedHeader } from "../(home)/PinnedHeader";
import styles from "../(site)/SiteShell.module.css";

/** Signed-in account and contact pages: the `(site)` shell's pinned header, without the landscape footer. */
export default function AccountLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className={`${styles.shell} ${display.variable} ${text.variable}`}>
      <PinnedHeader />
      <main className={styles.main} data-surface="light">
        {/* Only the content fades under the header; the white background stays solid. */}
        <div data-top-fade>{children}</div>
      </main>
    </div>
  );
}
