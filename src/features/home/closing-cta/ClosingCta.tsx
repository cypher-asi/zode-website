import type { ReactElement } from "react";
import { TerminalMenu, type TerminalMenuItem } from "@/components/ui/TerminalMenu";
import { COMPUTE_ACTIONS, ENGINEER_ACTION, THESIS_ACTION } from "@/lib/navigation";
import styles from "./ClosingCta.module.css";

const ACTIONS: readonly TerminalMenuItem[] = [...COMPUTE_ACTIONS, THESIS_ACTION, ENGINEER_ACTION];

/** Closing call to action between the network map and the footer landscape. */
export function ClosingCta(): ReactElement {
  return (
    <div className={styles.root} data-top-fade>
      <h2 className={styles.title}>Reclaim your sovereignty.</h2>
      <TerminalMenu items={ACTIONS} label="Get started" className={styles.menu} />
    </div>
  );
}
