import type { ReactElement } from "react";
import styles from "./NetworkPillars.module.css";

interface Pillar {
  readonly title: string;
  readonly description: string;
}

const PILLARS: readonly Pillar[] = [
  {
    title: "Sovereign",
    description:
      "Run workloads on infrastructure you control, with full ownership of your data and where it physically lives.",
  },
  {
    title: "Private",
    description:
      "End-to-end isolation keeps your compute and data shielded from everyone else sharing the network.",
  },
  {
    title: "Open Source",
    description:
      "Built in the open on transparent, auditable software that anyone can inspect, verify, and extend.",
  },
];

/**
 * Mid-page band on the Network page: a centered heading over three cards that
 * frame THE GRID's principles. Cards use blank placeholders for now; imagery is
 * dropped in later.
 */
export function NetworkPillars(): ReactElement {
  return (
    <section className={styles.section} aria-label="A distributed compute network">
      <div className={styles.inner}>
        <h2 className={styles.heading}>A distributed compute network.</h2>
        <div className={styles.grid}>
          {PILLARS.map((pillar) => (
            <article key={pillar.title} className={styles.card}>
              <div className={styles.placeholder} aria-hidden="true" />
              <h3 className={styles.cardTitle}>{pillar.title}</h3>
              <p className={styles.cardDescription}>{pillar.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
