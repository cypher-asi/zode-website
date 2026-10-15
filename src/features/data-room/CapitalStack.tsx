"use client";

import { useState, type CSSProperties, type ReactElement } from "react";
import { pct, usdShort } from "@/features/compute-model/format";
import styles from "./CapitalStack.module.css";

export interface CapitalSource {
  key: "equity" | "projectDebt" | "mortgage" | "prepayment" | "gpu";
  label: string;
  amount: number;
  /** What the source costs, in a few words. */
  cost: string;
}

/**
 * All the capital that enters the project as one bar, each source as wide as
 * its share. Hovering or focusing a source reads out its amount and cost.
 */
export function CapitalStack({ sources }: { sources: CapitalSource[] }): ReactElement | null {
  const [active, setActive] = useState<CapitalSource["key"] | null>(null);
  const shown = sources.filter((s) => s.amount > 0);
  const total = shown.reduce((sum, s) => sum + s.amount, 0);
  if (total <= 0) return null;
  const current = shown.find((s) => s.key === active);
  const share = (s: CapitalSource) => `${pct(s.amount / total, 0)} of capital`;

  return (
    <figure className={styles.stack} data-active={current ? "" : undefined} onMouseLeave={() => setActive(null)}>
      <div className={styles.head}>
        <span className={styles.label}>{current ? current.label : "Capital stack"}</span>
        <span className={styles.value}>{usdShort(current ? current.amount : total)}</span>
      </div>
      <p className={styles.note}>
        {current ? [share(current), current.cost].filter(Boolean).join(" · ") : "All capital entering the project"}
      </p>
      <div className={styles.bar}>
        {shown.map((s) => (
          <button
            key={s.key}
            type="button"
            className={styles.segment}
            data-source={s.key}
            data-active={s.key === active ? "" : undefined}
            style={{ flexGrow: s.amount } as CSSProperties}
            aria-label={`${s.label}, ${usdShort(s.amount)}, ${share(s)}`}
            onMouseEnter={() => setActive(s.key)}
            onFocus={() => setActive(s.key)}
            onBlur={() => setActive(null)}
          />
        ))}
      </div>
      <figcaption className={styles.legend}>
        {shown.map((s) => (
          <span
            key={s.key}
            className={styles.legendItem}
            data-source={s.key}
            data-active={s.key === active ? "" : undefined}
            onMouseEnter={() => setActive(s.key)}
          >
            <span className={styles.swatch} aria-hidden="true" />
            {s.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
