import type { ReactElement } from "react";
import styles from "./ProductStats.module.css";

interface Stat {
  readonly value: string;
  readonly unit?: string;
  readonly label: string;
}

const STATS: readonly Stat[] = [
  { value: "1.5", unit: "MW", label: "Power Capacity" },
  { value: "12", label: "Liquid-cooled Racks" },
  { value: "720", label: "B300 GPUs" },
];

/**
 * Headline spec row shown below the Product hero: large figures with an
 * optional unit and a muted caption, separated by hairline dividers.
 */
export function ProductStats(): ReactElement {
  return (
    <section className={styles.stats} aria-label="ZODE One specifications">
      <dl className={styles.row}>
        {STATS.map((stat) => (
          <div key={stat.label} className={styles.item}>
            <dd className={styles.value}>
              {stat.value}
              {stat.unit ? <span className={styles.unit}>{stat.unit}</span> : null}
            </dd>
            <dt className={styles.label}>{stat.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
