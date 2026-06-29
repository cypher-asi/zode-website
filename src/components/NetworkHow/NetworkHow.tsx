import type { ReactElement } from "react";
import Link from "next/link";
import styles from "./NetworkHow.module.css";

/**
 * Second section of the Network page (the "Learn More" scroll target): a
 * full-bleed backdrop with left-aligned copy describing how THE GRID works,
 * plus the two primary network actions. Mirrors the overlay pattern used by
 * the product page's closing CTA.
 */
export function NetworkHow(): ReactElement {
  return (
    <section
      id="how-it-works"
      className={styles.section}
      aria-label="How THE GRID works"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.image}
        src="/images/network-how.png"
        alt=""
        aria-hidden="true"
      />
      <div className={styles.scrim} aria-hidden="true" />
      <div className={styles.copy}>
        <h2 className={styles.title}>How THE GRID works</h2>
        <p className={styles.description}>
          THE GRID links rapidly deployable sites into a single distributed
          network. Providers contribute idle hardware, and customers tap that
          pooled capacity on demand &mdash; routed to the nearest available
          compute, anywhere on the network.
        </p>
        <div className={styles.actions}>
          <Link className={styles.primaryAction} href="/give-compute">
            Give Compute
          </Link>
          <Link className={styles.secondaryAction} href="/buy-compute">
            Buy Compute
          </Link>
        </div>
      </div>
    </section>
  );
}
