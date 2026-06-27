import type { ReactElement } from "react";
import styles from "./ShellBackdrop.module.css";

/*
 * A fixed, full-viewport backdrop that paints a soft white/gray gradient
 * which drifts slowly underneath the white shell frame. Only the shell chrome
 * (top nav, bottom taskbar, panel edges/corners) is transparent, so the motion
 * reads as a gentle living backdrop around the opaque content panel.
 *
 * Pure CSS (layered radial gradients on two slowly drifting layers) — no
 * canvas or WebGL, so it renders reliably everywhere.
 */
export function ShellBackdrop(): ReactElement {
  return (
    <div className={styles.backdrop} aria-hidden="true">
      <div className={styles.layerA} />
      <div className={styles.layerB} />
    </div>
  );
}
