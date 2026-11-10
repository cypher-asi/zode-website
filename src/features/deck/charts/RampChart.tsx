import { useState, type CSSProperties, type PointerEvent, type ReactElement } from "react";
import type { RampQuarter } from "../slides";
import styles from "./charts.module.css";

/** Where a quarter's revenue goes, from the bar's foot up: costs, then what's left over on top. */
export const RAMP_PARTS = [
  { key: "power", label: "Power" },
  { key: "opCosts", label: "Op costs" },
  { key: "debtService", label: "Debt service" },
  { key: "topco", label: "TopCo" },
  { key: "left", label: "Left over" },
] as const;

type PartKey = (typeof RAMP_PARTS)[number]["key"];

const REVENUE = [
  { key: "inference", label: "Inference" },
  { key: "merchant", label: "Merchant" },
  { key: "offtake", label: "Offtake" },
] as const;

const COSTS = [
  { key: "opCosts", label: "Op costs" },
  { key: "power", label: "Power" },
  { key: "debtService", label: "Debt service" },
  { key: "topco", label: "TopCo" },
] as const;

/** The slide's wide chart, and a squarer one for the deck's scroll mode, where only the years are labelled. */
const LAYOUTS = {
  wide: { W: 1000, H: 440, pad: { top: 12, right: 4, bottom: 52, left: 52 }, tip: { w: 250, h: 262 } },
  compact: { W: 520, H: 420, pad: { top: 12, right: 2, bottom: 36, left: 46 }, tip: { w: 300, h: 330 } },
} as const;

/** $3.92B, $98.1M, −$1.1M. */
export function usd(n: number): string {
  const sign = n < 0 ? "−" : "";
  const a = Math.abs(n);
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e6).toFixed(2)}M`;
  return a ? `${sign}$${Math.round(a)}` : "$0";
}

const totalOf = (q: RampQuarter) => q.revenue.inference + q.revenue.merchant + q.revenue.offtake;
const costOf = (q: RampQuarter) => q.costs.opCosts + q.costs.power + q.costs.debtService + q.costs.topco;
const amountOf = (q: RampQuarter, key: PartKey) => (key === "left" ? totalOf(q) - costOf(q) : q.costs[key]);

/** The scale's top and its gridlines: no more than five steps of 1, 2 or 5 times a power of ten. */
function scale(max: number): { top: number; ticks: number[] } {
  const raw = Math.max(max, 1) / 5;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step || step;
  return { top, ticks: Array.from({ length: Math.round(top / step) }, (_, i) => (i + 1) * step) };
}

/**
 * The consolidated model by quarter, one bar each: its height the quarter's
 * revenue, stacked from power at the foot through op costs, debt service and
 * TopCo to what's left over at the top. Hovering, focusing or tapping a bar
 * shows its revenue by how it's sold and where it went.
 */
export function RampChart({
  quarters,
  active,
  compact = false,
}: {
  quarters: readonly RampQuarter[];
  active: boolean;
  compact?: boolean;
}): ReactElement {
  const [shown, setShown] = useState<number | null>(null);
  const { W, H, pad: PAD, tip: TIP } = LAYOUTS[compact ? "compact" : "wide"];
  const { top, ticks } = scale(Math.max(...quarters.map(totalOf)));
  const SLOT = (W - PAD.left - PAD.right) / quarters.length;
  const BAR = SLOT * 0.62;
  const y = (usd: number) => H - PAD.bottom - (usd / top) * (H - PAD.top - PAD.bottom);
  const cx = (i: number) => PAD.left + SLOT * (i + 0.5);
  const years = quarters.reduce<{ year: string; from: number; to: number }[]>((runs, q, i) => {
    const year = q.quarter.slice(-4);
    if (runs.at(-1)?.year === year) runs[runs.length - 1].to = i;
    else runs.push({ year, from: i, to: i });
    return runs;
  }, []);
  const peak = quarters.reduce((best, q, i) => (totalOf(q) > totalOf(quarters[best]) ? i : best), 0);
  const leave = (event: PointerEvent) => {
    if (event.pointerType === "mouse") setShown(null);
  };

  const q = shown === null ? null : quarters[shown];
  const tipX = shown === null ? 0 : cx(shown) < W / 2 ? cx(shown) + BAR / 2 + 10 : cx(shown) - BAR / 2 - 10 - TIP.w;

  return (
    <svg
      className={`${styles.chart} ${styles.ramp}`}
      viewBox={`0 0 ${W} ${H}`}
      data-active={active || undefined}
      data-compact={compact || undefined}
      data-shown={shown === null ? undefined : true}
      role="group"
      aria-label={`Quarterly revenue, ${quarters[0].quarter} to ${quarters.at(-1)?.quarter}, peaking at ${usd(totalOf(quarters[peak]))} in ${quarters[peak].quarter}.`}
      onPointerLeave={leave}
    >
      {ticks.map((tick) => (
        <g key={tick}>
          <line className={styles.grid} x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} />
          <text className={styles.axis} x={PAD.left - 10} y={y(tick)} dy="0.35em" textAnchor="end">
            {usd(tick).replace(/\.00(?=[BM])/, "")}
          </text>
        </g>
      ))}
      <line className={styles.baseline} x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} />

      {quarters.map((quarter, i) => {
        const total = totalOf(quarter);
        let base = 0;
        return (
          <g
            key={quarter.quarter}
            className={styles.rampBar}
            data-shown={shown === i || undefined}
            style={{ "--d": i } as CSSProperties}
          >
            {RAMP_PARTS.map(({ key }) => {
              const from = Math.min(base, total);
              base += Math.max(amountOf(quarter, key), 0);
              const to = Math.min(base, total);
              return to > from ? (
                <rect
                  key={key}
                  className={styles.rampPart}
                  data-part={key}
                  x={cx(i) - BAR / 2}
                  width={BAR}
                  y={y(to)}
                  height={y(from) - y(to)}
                />
              ) : null;
            })}
          </g>
        );
      })}

      {compact
        ? null
        : quarters.map((quarter, i) => (
            <text
              key={quarter.quarter}
              className={styles.rampQuarter}
              data-shown={shown === i || undefined}
              x={cx(i)}
              y={H - PAD.bottom + 20}
              textAnchor="middle"
            >
              {quarter.quarter.slice(0, 2)}
            </text>
          ))}

      {years.map(({ year, from, to }) => (
        <text
          key={year}
          className={styles.axis}
          x={(cx(from) + cx(to)) / 2}
          y={H - PAD.bottom + (compact ? 24 : 44)}
          textAnchor="middle"
        >
          {year}
        </text>
      ))}

      {quarters.map((quarter, i) => (
        <rect
          key={quarter.quarter}
          className={styles.rampHit}
          x={cx(i) - SLOT / 2}
          y={PAD.top}
          width={SLOT}
          height={H - PAD.top}
          tabIndex={0}
          role="button"
          aria-label={`${quarter.quarter}: revenue ${usd(totalOf(quarter))}`}
          aria-pressed={shown === i}
          onPointerEnter={() => setShown(i)}
          onClick={() => setShown(i)}
          onFocus={() => setShown(i)}
          onBlur={() => setShown(null)}
        />
      ))}

      {q ? (
        <foreignObject x={tipX} y={PAD.top} width={TIP.w} height={TIP.h} className={styles.rampTipFrame}>
          <div className={styles.rampTip}>
            <p className={styles.rampTipHead}>
              <span>{q.quarter}</span>
              <span className={styles.rampTipTotal}>{usd(totalOf(q))}</span>
            </p>
            <dl className={styles.rampTipRows}>
              {REVENUE.map(({ key, label }) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>{usd(q.revenue[key])}</dd>
                </div>
              ))}
            </dl>
            <dl className={styles.rampTipRows}>
              {COSTS.map(({ key, label }) => (
                <div key={key}>
                  <dt>
                    <span className={styles.rampSwatch} data-part={key} aria-hidden="true" />
                    {label}
                  </dt>
                  <dd>{usd(-q.costs[key])}</dd>
                </div>
              ))}
            </dl>
            <dl className={styles.rampTipRows} data-left>
              <div>
                <dt>
                  <span className={styles.rampSwatch} data-part="left" aria-hidden="true" />
                  Left over
                </dt>
                <dd>{usd(totalOf(q) - costOf(q))}</dd>
              </div>
            </dl>
          </div>
        </foreignObject>
      ) : null}
    </svg>
  );
}
