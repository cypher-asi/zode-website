import type { ReactElement } from "react";
import Link from "next/link";
import { METRIC_DEFINITIONS, type MetricId } from "./definitions";
import { change, formatValue, type Unit } from "./format";
import styles from "./analytics.module.css";

export interface Kpi {
  metric: MetricId;
  value: number | null;
  previous: number | null;
  unit: Unit;
  /** Picks this figure for the chart. */
  href?: string;
  selected?: boolean;
}

/** The headline figures, each with its change from the previous period, coloured by whether that's good. */
export function KpiStrip({ items }: { items: Kpi[] }): ReactElement {
  return (
    <div className={styles.kpis}>
      {items.map((item) => {
        const definition = METRIC_DEFINITIONS[item.metric];
        const delta =
          item.value !== null && item.previous !== null ? change(item.value, item.previous, item.unit) : null;
        const good =
          !delta || delta.direction === "flat"
            ? undefined
            : String((delta.direction === "up") !== Boolean(definition.lowerIsBetter));
        const body = (
          <>
            <span className={styles.kpiLabel}>{definition.label}</span>
            <span className={styles.kpiValue}>{formatValue(item.value, item.unit, { short: true })}</span>
            <span className={styles.kpiChange} data-good={good}>
              {delta ? (
                <>
                  {delta.direction === "up" ? "↑" : delta.direction === "down" ? "↓" : ""} {delta.text}
                  <span className={styles.muted}> vs previous</span>
                </>
              ) : (
                " "
              )}
            </span>
          </>
        );
        return item.href ? (
          <Link
            key={item.metric}
            className={styles.kpi}
            href={item.href}
            title={definition.description}
            aria-current={item.selected ? "true" : undefined}
            scroll={false}
          >
            {body}
          </Link>
        ) : (
          <div key={item.metric} className={styles.kpi} title={definition.description}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
