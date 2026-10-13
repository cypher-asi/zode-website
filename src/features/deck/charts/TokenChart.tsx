import type { CSSProperties, ReactElement } from "react";
import { TOKENS, type Point } from "../research";
import styles from "./charts.module.css";

const X0 = 2024;
const X1 = 2030.5;
const YEARS = [2024, 2026, 2028, 2030];
/** Monthly tokens, in trillions: 0 to 120 quadrillion. */
const Y_TICKS = [0, 40_000, 80_000, 120_000];
const Y1 = 130_000;

const W = 520;
const H = 220;
const PAD = { top: 30, right: 40, bottom: 30, left: 40 };
const BAR = 3;
/** The hover target round each bar, a little under the quarter's spacing. */
const HIT = 14;
/** The least a bar is drawn, so Google's months show against the forecast. */
const MIN_BAR = 1.5;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const x = (year: number) => PAD.left + ((year - X0) / (X1 - X0)) * (W - PAD.left - PAD.right);
const y = (trillions: number) => H - PAD.bottom - (trillions / Y1) * (H - PAD.top - PAD.bottom);

/** 9.7 → "9.7T", 3,200 → "3.2Q": trillions, and quadrillions from a thousand of them. */
const short = (trillions: number) =>
  trillions === 0 ? "0" : trillions >= 1_000 ? `${+(trillions / 1_000).toFixed(1)}Q` : `${+trillions.toFixed(1)}T`;

/** 2025.55 → "Jul 2025". */
const month = (year: number) => `${MONTHS[Math.floor((year % 1) * 12 + 1e-6)]} ${Math.floor(year)}`;

const LAST = TOKENS.google[TOKENS.google.length - 1];
const [START, END] = [TOKENS.forecast[0], TOKENS.forecast[TOKENS.forecast.length - 1]];

/** The forecast a bar a quarter, compounding evenly between its two published ends. */
const FORECAST: readonly Point[] = Array.from({ length: (END[0] - START[0]) * 4 + 1 }, (_, i) => {
  const t = i / ((END[0] - START[0]) * 4);
  return [START[0] + t * (END[0] - START[0]), START[1] * (END[1] / START[1]) ** t];
});

/** A thin bar, and on hover its figure over it, anchored inward at the chart's ends. */
function Bars({ points, kind, from }: { points: readonly Point[]; kind: "actual" | "forecast"; from: number }): ReactElement {
  return (
    <>
      {points.map(([year, value], i) => {
        const top = Math.min(y(value), H - PAD.bottom - MIN_BAR);
        const cx = x(year);
        const share = (cx - PAD.left) / (W - PAD.left - PAD.right);
        const anchor = share < 0.1 ? "start" : share > 0.9 ? "end" : "middle";
        return (
          <g key={year} className={styles.tokenPoint}>
            <rect className={styles.tokenHit} x={cx - HIT / 2} y={PAD.top} width={HIT} height={H - PAD.top - PAD.bottom} />
            <rect
              className={styles.tokenBar}
              data-kind={kind}
              x={cx - BAR / 2}
              y={top}
              width={BAR}
              height={H - PAD.bottom - top}
              style={{ "--d": from + i } as CSSProperties}
            />
            <text className={styles.tokenTip} x={cx} y={top - 10} textAnchor={anchor}>
              <tspan className={styles.tokenValue}>
                {kind === "forecast" ? "~" : ""}
                {short(value)}
              </tspan>
              <tspan dx="6">
                {month(year)}
                {kind === "forecast" ? ", GS" : ", Google"}
              </tspan>
            </text>
          </g>
        );
      })}
    </>
  );
}

/**
 * Monthly AI tokens in thin bars: Google's disclosed volume, solid, then
 * Goldman Sachs' global forecast to 2030 a quarter at a time, grey. Each
 * bar's figure shows on hover. Drawn in the slide's own tones, so it reads
 * on any ground.
 */
export function TokenChart({ active, compact = false }: { active: boolean; compact?: boolean }): ReactElement {
  return (
    <svg
      className={`${styles.chart} ${styles.tokens}`}
      viewBox={`0 0 ${W} ${H}`}
      data-active={active || undefined}
      data-compact={compact || undefined}
      role="img"
      aria-label={`Monthly AI tokens: Google's rose from ${short(TOKENS.google[0][1])} in 2024 to ${short(LAST[1])} in May 2026; Goldman Sachs forecasts global use rising ${TOKENS.multiple}-fold to ${short(END[1])} a month by 2030.`}
    >
      {Y_TICKS.map((tick) => (
        <g key={tick}>
          <line className={styles.tokenGrid} x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} />
          <text className={styles.tokenAxis} x={PAD.left - 8} y={y(tick)} dy="0.35em" textAnchor="end">
            {short(tick)}
          </text>
        </g>
      ))}
      {YEARS.map((year) => (
        <text key={year} className={styles.tokenAxis} x={x(year)} y={H - 8} textAnchor="middle">
          {year}
        </text>
      ))}

      <Bars points={TOKENS.google} kind="actual" from={0} />
      <Bars points={FORECAST} kind="forecast" from={TOKENS.google.length} />
    </svg>
  );
}
