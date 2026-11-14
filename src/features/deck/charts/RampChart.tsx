import { useState, type CSSProperties, type PointerEvent, type ReactElement } from "react";
import type { RampPeriod } from "../slides";
import styles from "./charts.module.css";

/** The model's cash costs, then its debt service. */
const COSTS = [
  { key: "power", label: "Power" },
  { key: "opCosts", label: "Op costs" },
  { key: "topco", label: "TopCo" },
  { key: "interest", label: "Interest" },
  { key: "principal", label: "Debt repaid" },
] as const;

/** The costs that aren't any one site's; power and op costs are the sites' expenses. */
const COMPANY_COSTS = COSTS.filter(({ key }) => key !== "power" && key !== "opCosts");

const CASH = { key: "cash", label: "Cash after debt service" } as const;

/** Where a period's revenue goes, from the bar's foot up: costs and debt service, then the cash left on top. */
export const RAMP_PARTS = [...COSTS, CASH] as const;

type PartKey = (typeof RAMP_PARTS)[number]["key"];

/** The slide's wide chart, and a squarer one for the deck's scroll mode, where only the years are labelled. */
const LAYOUTS = {
  wide: { W: 1000, H: 440, pad: { top: 12, right: 4, bottom: 52, left: 52 }, tip: { w: 290, h: 340 } },
  compact: { W: 520, H: 420, pad: { top: 12, right: 2, bottom: 36, left: 46 }, tip: { w: 340, h: 372 } },
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

/** 248 MW, 12.5 MW. */
const mw = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 1 })} MW`;

const totalOf = (q: RampPeriod) => q.revenue.inference + q.revenue.merchant + q.revenue.offtake;
const amountOf = (q: RampPeriod, key: PartKey) => (key === "cash" ? q.cash : q.costs[key]);

/** The scale's top and its gridlines: no more than five steps of 1, 2 or 5 times a power of ten. */
function scale(max: number): { top: number; ticks: number[] } {
  const raw = Math.max(max, 1) / 5;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step || step;
  return { top, ticks: Array.from({ length: Math.round(top / step) }, (_, i) => (i + 1) * step) };
}

/** Each view's name, and how far apart its bars rise, in the stylesheet's steps of 60ms. */
const VIEWS = {
  quarters: { name: "Quarterly", stagger: 1 },
  months: { name: "Monthly", stagger: 1 / 3 },
  years: { name: "Annual", stagger: 2 },
} as const;

/**
 * The consolidated model by quarter, month or year, one bar each: its height
 * the period's revenue, stacked from power at the foot through op costs,
 * TopCo, interest and debt repaid to the cash it spins off at the top. Hovering, focusing or tapping a bar shows each site's revenue
 * and expenses with their total, and where the revenue went.
 */
export function RampChart({
  periods,
  view,
  active,
  compact = false,
}: {
  periods: readonly RampPeriod[];
  view: keyof typeof VIEWS;
  active: boolean;
  compact?: boolean;
}): ReactElement {
  const [shown, setShown] = useState<number | null>(null);
  const { W, H, pad: PAD, tip: TIP } = LAYOUTS[compact ? "compact" : "wide"];
  const { top, ticks } = scale(Math.max(...periods.map(totalOf)));
  const SLOT = (W - PAD.left - PAD.right) / periods.length;
  const BAR = Math.min(SLOT * (view === "years" ? 0.5 : 0.62), 120);
  const y = (usd: number) => H - PAD.bottom - (usd / top) * (H - PAD.top - PAD.bottom);
  const cx = (i: number) => PAD.left + SLOT * (i + 0.5);
  const years = periods.reduce<{ year: string; from: number; to: number }[]>((runs, p, i) => {
    const year = p.period.slice(-4);
    if (runs.at(-1)?.year === year) runs[runs.length - 1].to = i;
    else runs.push({ year, from: i, to: i });
    return runs;
  }, []);
  const peak = periods.reduce((best, p, i) => (totalOf(p) > totalOf(periods[best]) ? i : best), 0);
  /** "Q3" under a quarter, "A" under August; a year has only its year, on the row below. */
  const tick = (p: RampPeriod) => (view === "months" ? p.period.charAt(0) : p.period.slice(0, 2));
  const ticked = !compact && view !== "years";
  const leave = (event: PointerEvent) => {
    if (event.pointerType === "mouse") setShown(null);
  };

  const q = shown === null ? null : periods[shown];
  const tipX = shown === null ? 0 : cx(shown) < W / 2 ? cx(shown) + BAR / 2 + 10 : cx(shown) - BAR / 2 - 10 - TIP.w;

  return (
    <svg
      className={`${styles.chart} ${styles.ramp}`}
      viewBox={`0 0 ${W} ${H}`}
      data-active={active || undefined}
      data-compact={compact || undefined}
      data-shown={shown === null ? undefined : true}
      role="group"
      aria-label={`${VIEWS[view].name} revenue, ${periods[0].period} to ${periods.at(-1)?.period}, peaking at ${usd(totalOf(periods[peak]))} in ${periods[peak].period}.`}
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

      {periods.map((period, i) => {
        const total = totalOf(period);
        let base = 0;
        return (
          <g
            key={period.period}
            className={styles.rampBar}
            data-shown={shown === i || undefined}
            style={{ "--d": i * VIEWS[view].stagger } as CSSProperties}
          >
            {RAMP_PARTS.map(({ key }) => {
              const from = Math.min(base, total);
              base += Math.max(amountOf(period, key), 0);
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

      {!ticked
        ? null
        : periods.map((period, i) => (
            <text
              key={period.period}
              className={styles.rampTick}
              data-shown={shown === i || undefined}
              x={cx(i)}
              y={H - PAD.bottom + 20}
              textAnchor="middle"
            >
              {tick(period)}
            </text>
          ))}

      {years.map(({ year, from, to }) => (
        <text
          key={year}
          className={styles.axis}
          x={(cx(from) + cx(to)) / 2}
          y={H - PAD.bottom + (ticked ? 44 : 24)}
          textAnchor="middle"
        >
          {year}
        </text>
      ))}

      {periods.map((period, i) => (
        <rect
          key={period.period}
          className={styles.rampHit}
          x={cx(i) - SLOT / 2}
          y={PAD.top}
          width={SLOT}
          height={H - PAD.top}
          tabIndex={0}
          role="button"
          aria-label={`${period.period}: revenue ${usd(totalOf(period))}`}
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
              <span>
                {q.period} · {mw(q.mw)}
              </span>
              <span className={styles.rampTipTotal}>{usd(totalOf(q))}</span>
            </p>
            <table className={styles.rampTipSites}>
              <thead>
                <tr>
                  <th scope="col">Site</th>
                  <th scope="col">Revenue</th>
                  <th scope="col">Expenses</th>
                </tr>
              </thead>
              <tbody>
                {q.sites.map(({ site, revenue, expenses }) => (
                  <tr key={site}>
                    <th scope="row">{site}</th>
                    <td>{usd(revenue)}</td>
                    <td>{usd(-expenses)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  <td>{usd(totalOf(q))}</td>
                  <td>{usd(-q.sites.reduce((total, { expenses }) => total + expenses, 0))}</td>
                </tr>
              </tfoot>
            </table>
            {compact ? null : (
              <dl className={styles.rampTipRows}>
                {COMPANY_COSTS.map(({ key, label }) => (
                  <div key={key}>
                    <dt>
                      <span className={styles.rampSwatch} data-part={key} aria-hidden="true" />
                      {label}
                    </dt>
                    <dd>{usd(-q.costs[key])}</dd>
                  </div>
                ))}
              </dl>
            )}
            <dl className={styles.rampTipRows} data-net>
              <div>
                <dt>
                  <span className={styles.rampSwatch} data-part={CASH.key} aria-hidden="true" />
                  {CASH.label}
                </dt>
                <dd>{usd(q.cash)}</dd>
              </div>
            </dl>
          </div>
        </foreignObject>
      ) : null}
    </svg>
  );
}
