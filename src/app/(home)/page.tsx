import type { Metadata } from "next";
import { PinnedHeader } from "@/components/layout/PinnedHeader";
import { FooterReveal, FooterScene } from "@/components/layout/SiteFooter";
import { TerminalMenu, type TerminalMenuItem } from "@/components/ui/TerminalMenu";
import { AssemblyLine } from "@/features/home/assembly/AssemblyLine";
import { CircuitFrame } from "@/features/home/circuit/CircuitFrame";
import { ClosingCta } from "@/features/home/closing-cta/ClosingCta";
import { HeroSplitter } from "@/features/home/hero/HeroSplitter";
import { TypedLine } from "@/features/home/hero/TypedLine";
import { WordLoop } from "@/features/home/hero/WordLoop";
import { ZodeGallery } from "@/features/home/hero/ZodeGallery";
import { Network } from "@/features/home/network/Network";
import { PodTour } from "@/features/home/pod-tour/PodTour";
import { Principles } from "@/features/home/principles/Principles";
import { FullStack } from "@/features/home/stack/FullStack";
import { Features } from "@/features/home/why-zode/Features";
import { COMPUTE_ACTIONS } from "@/lib/navigation";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "ZODE: Sovereign Superintelligence.",
  description: "The fastest deployable AI data center.",
};

const HERO_ACTIONS: readonly TerminalMenuItem[] = [
  ...COMPUTE_ACTIONS,
  { id: "learn", label: "Learn More", href: "#learn-more" },
];

/**
 * Home page: a full-viewport split with the headline on a white panel and a
 * clickable ZODE render gallery on a black panel, followed by a hoverable pod
 * explorer and an autoplaying assembly-line build of a ZODE. It closes with a
 * rotating landscape band above the wordmark and a sideways copyright line;
 * the `(site)` pages reuse its pinned header and that footer.
 */
export default function HomePage() {
  return (
    <main className={styles.page}>
      <CircuitFrame />
      <PinnedHeader />

      <div className={styles.hero} data-circuit data-hero>
        <section className={styles.left} data-surface="light" data-circuit-seam>
          <div className={styles.copy} data-top-fade>
            <h1 className={styles.headline}>
              <span className={styles.line}>Sovereign</span>{" "}
              <span className={styles.line}>Superintelligence</span>
            </h1>
            <TerminalMenu items={HERO_ACTIONS} label="Get started" className={styles.menu} typeIn />
          </div>

          <div className={styles.bar} data-top-fade data-circuit-rule>
            <TypedLine
              className={`${styles.helper} ${styles.helperWide}`}
              text="The fastest deployable AI data center."
            />
            <TypedLine
              className={`${styles.helper} ${styles.helperNarrow}`}
              text="The fastest deployable compute."
            />
            <WordLoop />
          </div>

          <HeroSplitter />
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
        className={styles.principles}
        aria-label="What ZODE stands for"
        data-surface="light"
        data-circuit
      >
        <Principles />
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
