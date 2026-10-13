import type { CSSProperties, ReactElement } from "react";
import { TOKENS, type Point } from "../research";
import styles from "./charts.module.css";

const X0 = 2024;
const X1 = 2030.5;
const YEARS = [2024, 2026, 2028, 2030];
/** Decades of monthly tokens, in trillions: 10T to 100 quadrillion. */
const Y_TICKS = [10, 100, 1_000, 10_000, 100_000];
const [LOG0, LOG1] = [Math.log10(3), Math.log10(200_000)];

const W = 520;
const H = 220;
const PAD = { top: 14, right: 84, bottom: 30, left: 46 };
const BAR = 3;

const x = (year: number) => PAD.left + ((year - X0) / (X1 - X0)) * (W - PAD.left - PAD.right);
const y = (trillions: number) =>
  H - PAD.bottom - ((Math.log10(trillions) - LOG0) / (LOG1 - LOG0)) * (H - PAD.top - PAD.bottom);

/** 9.7 → "9.7T", 3,200 → "3.2Q": trillions, and quadrillions from a thousand of them. */
const short = (trillions: number) =>
  trillions >= 1_000 ? `${+(trillions / 1_000).toFixed(1)}Q` : `${+trillions.toFixed(1)}T`;

const LAST = TOKENS.google[TOKENS.google.length - 1];
const [START, END] = [TOKENS.forecast[0], TOKENS.forecast[TOKENS.forecast.length - 1]];

/** The forecast a bar a quarter, compounding evenly between its two published ends. */
const FORECAST: readonly Point[] = Array.from({ length: (END[0] - START[0]) * 4 + 1 }, (_, i) => {
  const t = i / ((END[0] - START[0]) * 4);
  return [START[0] + t * (END[0] - START[0]), START[1] * (END[1] / START[1]) ** t];
});

function Bars({ points, kind, from }: { points: readonly Point[]; kind: string; from: number }): ReactElement {
  return (
    <>
      {points.map(([year, value], i) => (
        <rect
          key={year}
          className={styles.tokenBar}
          data-kind={kind}
          x={x(year) - BAR / 2}
          y={y(value)}
          width={BAR}
          height={H - PAD.bottom - y(value)}
          style={{ "--d": from + i } as CSSProperties}
        />
      ))}
    </>
  );
}

/**
 * Monthly AI tokens on a log scale, in thin bars: Google's disclosed volume,
 * solid, then Goldman Sachs' global forecast to 2030 a quarter at a time,
 * grey, each named at its end. Drawn in the slide's own tones, so it reads
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
      aria-label={`Monthly AI tokens, log scale: Google's rose from ${short(TOKENS.google[0][1])} in 2024 to ${short(LAST[1])} in May 2026; Goldman Sachs forecasts global use rising ${TOKENS.multiple}-fold to ${short(END[1])} a month by 2030.`}
    >
      {Y_TICKS.map((tick) => (
        <g key={tick}>
          <line className={styles.tokenGrid} x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} />
          <text className={styles.tokenAxis} x={PAD.left - 10} y={y(tick)} dy="0.35em" textAnchor="end">
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

      <g className={styles.tokenLabels}>
        <text className={styles.tokenValue} x={x(END[0]) + 10} y={y(END[1])} dy="0.7em">
          {short(END[1])}
        </text>
        <text className={styles.tokenNote} x={x(END[0]) + 10} y={y(END[1])} dy="2.3em">
          Global, GS
        </text>
        <text className={styles.tokenValue} x={x(LAST[0]) - 8} y={y(LAST[1])} dy="-1.7em" textAnchor="end">
          {short(LAST[1])}
        </text>
        <text className={styles.tokenNote} x={x(LAST[0]) - 8} y={y(LAST[1])} dy="-0.6em" textAnchor="end">
          Google
        </text>
      </g>
    </svg>
  );
}
