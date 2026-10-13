import type { CSSProperties, ReactElement } from "react";
import { TOKENS } from "../research";
import styles from "./charts.module.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const YEARS = [2025, 2026, 2027, 2028, 2029, 2030];
/** The top of the scale, in trillions of tokens a month, just over the forecast's end. */
const Y1 = 130_000;

const W = 520;
const H = 220;
const PAD = { top: 8, right: 12, bottom: 30, left: 12 };
const BAR = 3;
/** The least a bar is drawn, so the early months show as a rising floor rather than nothing. */
const MIN_BAR = 1;

/** 2025.55 → months since year 0, counting from January. */
const monthOf = (year: number) => Math.floor(year) * 12 + Math.floor((year % 1) * 12 + 1e-6);

/** Published figures, by month: Google's disclosures, then Goldman Sachs' global forecast. */
const ANCHORS = [
  ...TOKENS.google.map(([year, value]) => ({ n: monthOf(year), value })),
  ...TOKENS.forecast.map(([year, value]) => ({ n: monthOf(year), value })),
];
const LAST_GOOGLE = monthOf(TOKENS.google[TOKENS.google.length - 1][0]);
const [FIRST, LAST] = [ANCHORS[0].n, ANCHORS[ANCHORS.length - 1].n];

/**
 * A bar a month from the first figure to the last: published months as
 * published, the months between compounding evenly from one figure to the next.
 */
const BARS = Array.from({ length: LAST - FIRST + 1 }, (_, i) => {
  const n = FIRST + i;
  const next = ANCHORS.findIndex((a) => a.n >= n);
  const [a, b] = [ANCHORS[Math.max(next - 1, 0)], ANCHORS[next]];
  const published = b.n === n;
  const value = published ? b.value : a.value * (b.value / a.value) ** ((n - a.n) / (b.n - a.n));
  return { n, value, published, kind: n <= LAST_GOOGLE ? "actual" : "forecast" } as const;
});

/** Each month's bar sits mid-month. */
const x = (n: number) => PAD.left + ((n - FIRST + 0.5) / (LAST - FIRST + 1)) * (W - PAD.left - PAD.right);
const STEP = (W - PAD.left - PAD.right) / (LAST - FIRST + 1);
const y = (trillions: number) => H - PAD.bottom - (trillions / Y1) * (H - PAD.top - PAD.bottom);

/** 9.7 → "9.7T", 3,200 → "3.2Q": trillions, and quadrillions from a thousand of them. */
const short = (trillions: number) =>
  trillions >= 1_000 ? `${+(trillions / 1_000).toFixed(1)}Q` : `${+trillions.toFixed(1)}T`;

const [GOOGLE0, GOOGLE1] = [TOKENS.google[0][1], TOKENS.google[TOKENS.google.length - 1][1]];

/**
 * Monthly AI tokens, a thin bar a month, no gridlines: Google's volume to
 * May 2026, solid, then Goldman Sachs' global forecast to 2030, grey. Each
 * bar's figure shows on hover, estimated months marked "~". Drawn in the
 * slide's own tones, so it reads on any ground.
 */
export function TokenChart({ active, compact = false }: { active: boolean; compact?: boolean }): ReactElement {
  return (
    <svg
      className={`${styles.chart} ${styles.tokens}`}
      viewBox={`0 0 ${W} ${H}`}
      data-active={active || undefined}
      data-compact={compact || undefined}
      role="img"
      aria-label={`Monthly AI tokens: Google's rose from ${short(GOOGLE0)} in 2024 to ${short(GOOGLE1)} in May 2026; Goldman Sachs forecasts global use rising ${TOKENS.multiple}-fold to ${short(ANCHORS[ANCHORS.length - 1].value)} a month by 2030.`}
    >
      {YEARS.map((year) => (
        <text key={year} className={styles.tokenAxis} x={x(year * 12) - STEP / 2} y={H - 8} textAnchor="middle">
          {year}
        </text>
      ))}

      {BARS.map(({ n, value, published, kind }, i) => {
        const top = Math.min(y(value), H - PAD.bottom - MIN_BAR);
        const cx = x(n);
        const share = i / (BARS.length - 1);
        const anchor = share < 0.1 ? "start" : share > 0.9 ? "end" : "middle";
        return (
          <g key={n} className={styles.tokenPoint}>
            <rect className={styles.tokenHit} x={cx - STEP / 2} y={PAD.top} width={STEP} height={H - PAD.top - PAD.bottom} />
            <rect
              className={styles.tokenBar}
              data-kind={kind}
              x={cx - BAR / 2}
              y={top}
              width={BAR}
              height={H - PAD.bottom - top}
              style={{ "--d": i } as CSSProperties}
            />
            <text className={styles.tokenTip} x={cx} y={top - 10} textAnchor={anchor}>
              <tspan className={styles.tokenValue}>
                {published ? "" : "~"}
                {short(value)}
              </tspan>
              <tspan dx="6">
                {MONTHS[n % 12]} {Math.floor(n / 12)}
                {kind === "actual" ? ", Google" : ", GS"}
              </tspan>
            </text>
          </g>
        );
      })}
    </svg>
  );
}
