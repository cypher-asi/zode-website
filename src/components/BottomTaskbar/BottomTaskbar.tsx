import type { ReactElement } from "react";
import { RotatingTagline } from "@/components/RotatingTagline";
import styles from "./BottomTaskbar.module.css";

/**
 * Bottom chrome strip mirroring the aura-os public-mode taskbar: a
 * centered rotating value-prop tagline. Edge clusters use `space-between`
 * so the tagline stays optically centered.
 */
export function BottomTaskbar(): ReactElement {
  return (
    <footer className={styles.bar}>
      <div className={styles.side} />
      <div className={styles.center}>
        <div className={styles.taglineBubble}>
          <RotatingTagline />
        </div>
      </div>
      <div className={styles.side} />
    </footer>
  );
}
