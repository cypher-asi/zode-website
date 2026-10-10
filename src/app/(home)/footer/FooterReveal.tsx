import type { ReactElement } from "react";
import styles from "./FooterReveal.module.css";

/**
 * Band under the landscape: the faded wordmark, centred, with a sideways
 * copyright line in the right-hand rail.
 */
export function FooterReveal(): ReactElement {
  return (
    <div className={styles.root} data-circuit-rule>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.mark} src="/wordmark.svg" alt="" aria-hidden="true" />
      <p className={styles.copyright}>Copyright 2026 ZODE, Inc.</p>
    </div>
  );
}
