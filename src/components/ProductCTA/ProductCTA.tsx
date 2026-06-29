import type { ReactElement } from "react";
import Link from "next/link";
import styles from "./ProductCTA.module.css";

/**
 * Closing call-to-action band for the Product page: a full-bleed cabin photo
 * with top-aligned centered copy and a single estimate button. Rendered as the
 * last page child so it sits between the specs section and the site footer.
 */
export function ProductCTA(): ReactElement {
  return (
    <section className={styles.cta} aria-label="Get a ZODE One estimate">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.image}
        src="/images/cta-cabin.png"
        alt="A ZODE unit overlooking a mountain lake at dusk."
      />
      <div className={styles.scrim} aria-hidden="true" />
      <div className={styles.copy}>
        <h2 className={styles.title}>ZODE One</h2>
        <p className={styles.subtitle}>Deploy your site today.</p>
        <Link className={styles.button} href="#">
          Get an Estimate
        </Link>
      </div>
    </section>
  );
}
