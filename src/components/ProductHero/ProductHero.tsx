import type { ReactElement } from "react";
import styles from "./ProductHero.module.css";

/**
 * Full-bleed hero for the Product page: an edge-to-edge image with a bottom
 * gradient scrim and bottom-left intro copy. Sits inside the (site) shell's
 * normally-scrolling body panel.
 */
export function ProductHero(): ReactElement {
  return (
    <section className={styles.hero} aria-label="Meet ZODE One">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.image}
        src="/product-hero.png"
        alt="A ZODE One rapidly deployable data center sited in a remote valley at dusk."
      />
      <div className={styles.scrim} aria-hidden="true" />
      <div className={styles.copy}>
        <h1 className={styles.title}>Meet ZODE One.</h1>
        <p className={styles.description}>
          The first rapidly deployable data center to respond to the AI energy
          crisis.
        </p>
      </div>
    </section>
  );
}
