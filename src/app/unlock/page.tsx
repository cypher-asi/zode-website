import type { ReactElement } from "react";
import { GridLogo } from "@/components/GridLogo";
import { UnlockForm } from "./UnlockForm";
import styles from "./unlock.module.css";

export default function UnlockPage(): ReactElement {
  return (
    <main className={styles.shell}>
      <div className={styles.panel}>
        <div className={styles.brand}>
          <GridLogo showWordmark={false} />
          <span className={styles.wordmark}>ZODE</span>
        </div>
        <p className={styles.prompt}>Enter the password to continue.</p>
        <UnlockForm />
      </div>
    </main>
  );
}
