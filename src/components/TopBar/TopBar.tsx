import type { ReactElement } from "react";
import { GridLogo } from "@/components/GridLogo";
import styles from "./TopBar.module.css";

export function TopBar(): ReactElement {
  return (
    <header className={styles.topBar}>
      <div className={styles.leading}>
        <GridLogo />
      </div>
    </header>
  );
}
