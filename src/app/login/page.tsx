import type { ReactElement } from "react";
import { GridLogo } from "@/components/GridLogo";
import { LoginForm } from "./LoginForm";
import styles from "./login.module.css";

export default function LoginPage(): ReactElement {
  return (
    <main className={styles.shell}>
      <div className={styles.panel}>
        <div className={styles.brand}>
          <GridLogo showWordmark={false} />
          <span className={styles.wordmark}>ZODE</span>
        </div>
        <p className={styles.prompt}>Enter the password to continue.</p>
        <LoginForm />
      </div>
    </main>
  );
}
