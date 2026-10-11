import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import { COMPUTE_ACTIONS } from "./actions";
import { AssemblyLine } from "./assembly/AssemblyLine";
import { CircuitFrame } from "./circuit/CircuitFrame";
import { ClosingCta } from "./cta/ClosingCta";
import { Features } from "./features/Features";
import { FooterReveal } from "./footer/FooterReveal";
import { FooterScene } from "./footer/FooterScene";
import { Network } from "./network/Network";
import { PinnedHeader } from "./PinnedHeader";
import { PodTour } from "./pod/PodTour";
import { FullStack } from "./stack/FullStack";
import { TerminalMenu, type TerminalMenuItem } from "@/components/TerminalMenu";
import { WordLoop } from "./WordLoop";
import { ZodeGallery } from "./ZodeGallery";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "ZODE: Sovereign Superintelligence.",
  description: "The fastest deployable AI data center.",
};

const HERO_ACTIONS: readonly TerminalMenuItem[] = [
  ...COMPUTE_ACTIONS,
  { id: "learn", label: "Learn More", href: "#learn-more" },
];

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
 * Home page: a full-viewport split with the headline on a white panel and a
 * clickable ZODE render gallery on a black panel, followed by a hoverable pod
 * explorer and an autoplaying assembly-line build of a ZODE. It closes with a
 * rotating landscape band above the wordmark and a sideways copyright line;
 * the `(site)` pages reuse its pinned header and that footer.
 */
export default function HomePage() {
  return (
    <main className={`${styles.page} ${display.variable} ${text.variable}`}>
      <CircuitFrame />
      <PinnedHeader />

      <div className={styles.hero} data-circuit>
        <section className={styles.left} data-surface="light" data-circuit-seam>
          <div className={styles.copy} data-top-fade>
            <h1 className={styles.headline}>
              <span className={styles.line}>Sovereign</span>{" "}
              <span className={styles.line}>Superintelligence</span>
            </h1>
            <TerminalMenu items={HERO_ACTIONS} label="Get started" className={styles.menu} />
          </div>

          <div className={styles.bar} data-top-fade data-circuit-rule>
            <p className={styles.helper}>The fastest deployable AI data center.</p>
            <WordLoop />
          </div>
        </section>

        <section
          className={styles.right}
          aria-label="ZODE gallery"
          data-surface="dark"
          data-circuit-rule
        >
          <ZodeGallery />
        </section>
      </div>

      <section
        id="learn-more"
        className={styles.tour}
        aria-label="A rapidly deployable supercomputer"
        data-surface="light"
        data-circuit
      >
        <PodTour />
      </section>

      <section
        className={styles.stack}
        aria-label="The ZODE stack"
        data-surface="light"
        data-circuit
      >
        <FullStack />
      </section>

      <section
        className={styles.assembly}
        aria-label="How a ZODE is built"
        data-surface="dark"
        data-circuit
      >
        <AssemblyLine />
      </section>

      <section className={styles.features} aria-label="Why ZODE" data-surface="light" data-circuit>
        <Features />
      </section>

      <section
        className={styles.network}
        aria-label="Distributed edge network"
        data-surface="dark"
        data-circuit
      >
        <Network />
      </section>

      <section className={styles.closing} aria-label="Get started" data-surface="dark" data-circuit>
        <ClosingCta />
      </section>

      <footer
        className={styles.footer}
        aria-label="Site footer"
        data-surface="dark"
        data-circuit
      >
        <FooterScene />
        <FooterReveal />
      </footer>
    </main>
  );
}
