import type { ReactElement } from "react";
import { COVER_ID } from "@/components/Cover";
import styles from "./TopBar.module.css";

export function TopBar(): ReactElement {
  return (
    <header className={styles.topBar}>
      <a className={styles.leading} href={`#${COVER_ID}`} aria-label="ZODE — back to cover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.wordmark} src="/wordmark.png" alt="" aria-hidden="true" />
      </a>
    </header>
  );
}
