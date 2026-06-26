import type { ReactElement } from "react";
import styles from "./ProductFeature.module.css";

/**
 * Full-width feature image with a centered caption underneath, echoing the
 * showcase blocks used on premium product pages.
 */
export function ProductFeature(): ReactElement {
  return (
    <section className={styles.feature} aria-label="Meet ZODE One">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.image}
        src="/product-interior.png"
        alt="ZODE One server racks installed inside a timber A-frame overlooking a mountain lake."
      />
      <h2 className={styles.caption}>Meet ZODE One.</h2>
    </section>
  );
}
