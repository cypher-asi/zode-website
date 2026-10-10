import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/session";
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
  title: "ZODE — Sovereign Super Intelligence",
  description: "The fastest deployable data center.",
};

const HERO_ACTIONS: readonly TerminalMenuItem[] = [
  { id: "rent", label: "Rent Compute", href: "/buy-compute" },
  { id: "own", label: "Own Compute", href: "/deployments" },
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
 * Candidate replacement for the home page: a full-viewport split with the
 * headline on a white panel and a clickable ZODE render gallery on a black
 * panel, followed by a hoverable pod explorer and an autoplaying
 * assembly-line build of a ZODE. Lives
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
      <CircuitFrame />
      <PinnedHeader />

      <div className={styles.hero} data-circuit>
        <section className={styles.left} data-surface="light" data-circuit-seam>
          <div className={styles.copy} data-top-fade>
            <h1 className={styles.headline}>
              <span className={styles.line}>Sovereign</span>{" "}
              <span className={styles.line}>Super Intelligence</span>
            </h1>
            <TerminalMenu items={HERO_ACTIONS} label="Get started" className={styles.menu} />
          </div>

          <div className={styles.bar} data-top-fade>
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

      <footer className={styles.footer} aria-label="Site footer" data-surface="dark" data-circuit>
        <FooterScene />
        <FooterReveal />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.footerMark} src="/wordmark.png" alt="" aria-hidden="true" />
      </footer>
    </main>
  );
}
