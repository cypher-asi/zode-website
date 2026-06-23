import type { ReactElement } from "react";
import { COVER_ID } from "@/components/Cover";
import styles from "./TopBar.module.css";

export function TopBar(): ReactElement {
  return (
    <header className={styles.topBar}>
      <a className={styles.leading} href={`#${COVER_ID}`} aria-label="ZODE — back to cover">
        ZODE
      </a>
    </header>
  );
}
