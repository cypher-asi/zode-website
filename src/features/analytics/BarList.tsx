import type { CSSProperties, ReactElement, ReactNode } from "react";
import Link from "next/link";
import { formatValue, type Unit } from "./format";
import styles from "./analytics.module.css";

export interface BarRow {
  key: string;
  label: string;
  value: number;
  /** A second figure, e.g. the share of the total. */
  detail?: string;
  /** Filters the report by this row, or opens its own report. */
  href?: string;
}

/** A ranked list with each row's share drawn behind it, longest first. */
export function BarList({
  rows,
  unit = "count",
  label,
  valueLabel,
  empty = "Nothing in this range yet.",
}: {
  rows: BarRow[];
  unit?: Unit;
  label: string;
  valueLabel: string;
  empty?: string;
}): ReactElement {
  if (!rows.length) return <p className={styles.none}>{empty}</p>;
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <>
      <div className={styles.columns} aria-hidden="true">
        <span>{label}</span>
        <span>{valueLabel}</span>
      </div>
      <ul className={styles.bars}>
        {rows.map((row) => (
          <li key={row.key} className={styles.bar} style={{ "--share": `${(row.value / max) * 100}%` } as CSSProperties}>
            {row.href ? (
              <Link className={styles.barLink} href={row.href} title={row.label} scroll={false}>
                {row.label}
              </Link>
            ) : (
              <span className={styles.barLabel} title={row.label}>
                {row.label}
              </span>
            )}
            <span className={styles.barValue}>
              {formatValue(row.value, unit)}
              {row.detail ? <small>{row.detail}</small> : null}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** A titled block on a report, with a link through to the full breakdown. */
export function Panel({
  title,
  href,
  wide = false,
  children,
}: {
  title: string;
  href?: string;
  wide?: boolean;
  children: ReactNode;
}): ReactElement {
  return (
    <section className={wide ? styles.panelWide : styles.panel} aria-label={title}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>{title}</h2>
        {href ? (
          <Link className={styles.panelMore} href={href}>
            View all
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}
