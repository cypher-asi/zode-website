import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/session";
import { AssemblyLine } from "./assembly/AssemblyLine";
import { Features } from "./features/Features";
import { FooterReveal } from "./footer/FooterReveal";
import { FooterScene } from "./footer/FooterScene";
import { PinnedBrand } from "./PinnedBrand";
import { FullStack } from "./stack/FullStack";
import { TerminalMenu } from "./TerminalMenu";
import { WordLoop } from "./WordLoop";
import { ZodeGallery } from "./ZodeGallery";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "ZODE — Sovereign Super Intelligence",
  description: "The fastest deployable data center.",
};

const display = Newsreader({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz"],
});

const text = Inter({
  variable: "--font-text",
  subsets: ["latin"],
});

/**
 * Candidate replacement for the home page: a full-viewport split with the
 * headline on a white panel and a clickable ZODE render gallery on a black
 * panel, followed by an autoplaying assembly-line build of a ZODE. Lives
 * outside the `(site)` group so it renders without the shared nav and
 * taskbar; it closes with a rotating landscape band whose copyright line
 * reveals the shared footer links.
 */
export default async function FutureHome() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  return (
    <main className={`${styles.page} ${display.variable} ${text.variable}`}>
      <PinnedBrand />

      <div className={styles.hero}>
        <section className={styles.left} data-surface="light">
          <div className={styles.copy}>
            <h1 className={styles.headline}>
              <span className={styles.line}>Sovereign</span>{" "}
              <span className={styles.line}>Super Intelligence</span>
            </h1>
            <TerminalMenu />
          </div>

          <div className={styles.bar}>
            <p className={styles.helper}>The fastest deployable data center.</p>
            <WordLoop />
          </div>
        </section>

        <section className={styles.right} aria-label="ZODE gallery" data-surface="dark">
          <ZodeGallery />
        </section>
      </div>

      <section
        id="learn-more"
        className={styles.assembly}
        aria-label="How a ZODE is built"
        data-surface="dark"
      >
        <AssemblyLine />
      </section>

      <section className={styles.stack} aria-label="The ZODE stack" data-surface="light">
        <FullStack />
      </section>

      <section className={styles.features} aria-label="Why ZODE" data-surface="light">
        <Features />
      </section>

      <footer className={styles.footer} aria-label="Site footer" data-surface="dark">
        <FooterScene />
        <FooterReveal />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.footerMark} src="/wordmark.png" alt="" aria-hidden="true" />
      </footer>
    </main>
  );
}
