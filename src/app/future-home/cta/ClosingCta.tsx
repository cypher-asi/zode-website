import type { ReactElement } from "react";
import { TerminalMenu, type TerminalMenuItem } from "@/components/TerminalMenu";
import styles from "./ClosingCta.module.css";

const ACTIONS: readonly TerminalMenuItem[] = [
  { id: "rent", label: "Rent Compute", href: "/buy-compute" },
  { id: "own", label: "Own Compute", href: "/own-compute" },
  { id: "meet", label: "Schedule Meeting", href: "/contact" },
];

/** Closing call to action between the network map and the footer landscape. */
export function ClosingCta(): ReactElement {
  return (
    <div className={styles.root} data-top-fade>
      <h2 className={styles.title}>Reclaim your sovereignty.</h2>
      <TerminalMenu items={ACTIONS} label="Start building" className={styles.menu} />
    </div>
  );
}
