"use client";

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from "react";
import { Segmented } from "@/features/configurator/StepPanel";
import { AnnualTable } from "./AnnualTable";
import { usdShort } from "./format";
import type { ModelResult, MonthlySeries } from "./model/engine";
import styles from "./ModelChart.module.css";

type FlowKey = "netRevenue" | "ebitda" | "netProfit";
type BalanceKey = "debtBalance" | "cumulativeEquity" | "netBookValue" | "cumulativeDistributions";

interface SeriesDef<K> {
  key: K;
  label: string;
  color: string;
}

/** Flows summed over each period, drawn as bars in a gray ramp that ends at ink for the bottom line. */
const BARS: readonly SeriesDef<FlowKey>[] = [
  { key: "netRevenue", label: "Revenue", color: "var(--color-border-strong)" },
  { key: "ebitda", label: "EBITDA", color: "var(--color-border-hover)" },
  { key: "netProfit", label: "Net profit", color: "var(--color-ink)" },
];

/** Balances at the end of each period, drawn as lines in the category colors. */
const LINES: readonly SeriesDef<BalanceKey>[] = [
  { key: "debtBalance", label: "Debt", color: "var(--color-violet)" },
  { key: "cumulativeEquity", label: "Equity", color: "var(--color-info)" },
  { key: "netBookValue", label: "Book value", color: "var(--color-text-secondary)" },
  { key: "cumulativeDistributions", label: "Distributions", color: "var(--color-success)" },
];

const LEGEND = [
  ...BARS.map((s) => ({ ...s, kind: "bar" })),
  ...LINES.map((s) => ({ ...s, kind: "line" })),
];

const VIEWS = [
  { id: "annual", label: "Annual" },
  { id: "monthly", label: "Monthly" },
  { id: "table", label: "Table" },
] as const;

type View = (typeof VIEWS)[number]["id"];
type ChartView = Exclude<View, "table">;

interface Point {
  label: string;
  axis: string;
  values: Record<FlowKey | BalanceKey, number>;
}

const PAD = { top: 16, right: 12, bottom: 28, left: 56 };
const RIGHT_AXIS = 52;

const monthName = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

function pointsFor(result: ModelResult, view: ChartView): Point[] {
  const m: MonthlySeries = result.monthly;
  const at = (from: number, to: number, label: string, axis: string): Point => {
    const values = {} as Point["values"];
    for (const s of BARS) {
      let total = 0;
      for (let k = from; k < to; k++) total += m[s.key][k];
      values[s.key] = total;
    }
    for (const s of LINES) values[s.key] = m[s.key][Math.max(from, to - 1)];
    return { label, axis, values };
  };

  if (view === "annual") {
    return result.periods
      .filter((p) => p.to > p.from)
      .map((p) => {
        const range = `${monthName(m.dates[p.from])} to ${monthName(m.dates[p.to - 1])}`;
        const axis = p.label === "Startup" ? "Startup" : p.label === "Remaining" ? "Tail" : p.label.replace("Year ", "Y");
        return at(p.from, p.to, `${p.label}, ${range}`, axis);
      });
  }
  const first = result.firstOperatingMonth;
  return m.dates.map((date, k) => {
    const opMonth = k - first + 1;
    const axis = k === 0 ? "M0" : opMonth > 0 && (opMonth - 1) % 12 === 0 ? `Y${(opMonth - 1) / 12 + 1}` : "";
    return at(k, k + 1, `Month ${k}, ${monthName(date)}`, axis);
  });
}

const tickLabel = (v: number) => {
  const a = Math.abs(v);
  const unit = a >= 1e9 ? 1e9 : a >= 1e6 ? 1e6 : 1;
  return usdShort(v, unit > 1 && !Number.isInteger(Number((a / unit).toFixed(6))) ? 1 : 0);
};

function niceStep(raw: number): number {
  if (!(raw > 0)) return 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw * (1 - 1e-9)) ?? raw;
}

interface Grid {
  below: number;
  above: number;
  /** Tick spacing for each value group, in the order given. */
  steps: number[];
}

interface GridGroup {
  values: number[];
  /** Let negative outliers run off the plot rather than squash the rest. */
  clipNegative?: boolean;
}

/**
 * Gridlines `below` steps under zero and `above` steps over it, with a round
 * step size per value group so a second axis shares the same lines and zero.
 */
function sharedGrid(groups: GridGroup[], count = 5): Grid {
  const extents = groups.map(({ values, clipNegative }) => {
    const lo = Math.min(0, ...values);
    const hi = Math.max(0, ...values);
    const share = hi > lo ? -lo / (hi - lo) : 0;
    return { lo, hi, clipNegative, share: clipNegative && hi > 0 ? Math.min(share, 1 / count) : share };
  });
  const negShare = Math.max(0, ...extents.map((e) => e.share));
  const below = negShare > 0 ? Math.max(1, Math.round(count * negShare)) : 0;
  const above = Math.max(1, count - below);
  const steps = extents.map((e) => {
    const up = e.hi / above;
    const down = below ? -e.lo / below : 0;
    return niceStep(e.clipNegative && up > 0 ? Math.max(up, Math.min(down, up * 2)) : Math.max(up, down));
  });
  return { below, above, steps };
}

/**
 * Revenue, EBITDA and profit as bars with the debt, equity, capital and
 * distribution balances as lines, by year or by month, or the same years as a
 * table. Each series can be hidden from the legend; hovering a period lists
 * its values.
 */
export function ModelChart({ result }: { result: ModelResult }): ReactElement {
  const [view, setView] = useState<View>("annual");
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [hover, setHover] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 720, height: 320 });

  const showTable = view === "table";
  const chartView: ChartView = view === "monthly" ? "monthly" : "annual";

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.max(280, width), height: Math.max(220, height) });
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, [showTable]);

  const points = useMemo(() => pointsFor(result, chartView), [result, chartView]);
  const bars = BARS.filter((s) => !hidden.has(s.key));
  const lines = LINES.filter((s) => !hidden.has(s.key));

  // Monthly flows are an order of magnitude below the balances, so they get their own axis.
  const dual = view === "monthly" && bars.length > 0 && lines.length > 0;
  const { width, height } = size;
  const right = dual ? RIGHT_AXIS : PAD.right;
  const plotW = width - PAD.left - right;
  const plotH = height - PAD.top - PAD.bottom;

  const barValues = points.flatMap((p) => bars.map((s) => p.values[s.key]));
  const lineValues = points.flatMap((p) => lines.map((s) => p.values[s.key]));
  const grid = sharedGrid(
    dual
      ? [{ values: lineValues }, { values: barValues, clipNegative: true }]
      : [{ values: [...lineValues, ...barValues] }],
  );
  const lineStep = grid.steps[0];
  const barStep = grid.steps[dual ? 1 : 0];
  const gridSteps = Array.from({ length: grid.below + grid.above + 1 }, (_, i) => i - grid.below);
  const yAt = (step: number) => (v: number) =>
    PAD.top + (plotH * (grid.above - v / step)) / (grid.above + grid.below);
  const yLine = yAt(lineStep);
  const yBar = yAt(barStep);

  const band = plotW / points.length;
  const xCenter = (k: number) => PAD.left + band * (k + 0.5);
  const groupW = band * (view === "annual" ? 0.7 : 0.8);
  const barW = bars.length ? groupW / bars.length : 0;

  const toggle = (key: string) =>
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const hovered = hover === null ? null : points[hover];
  const tipLeft = hover === null ? 0 : xCenter(hover);

  return (
    <figure className={styles.chart}>
      <div className={styles.toolbar}>
        {showTable ? (
          <p className={styles.tableTitle}>Annual results and cash distributions, USD millions</p>
        ) : (
          <ul className={styles.legend} aria-label="Chart series">
            {LEGEND.map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  className={styles.legendItem}
                  aria-pressed={!hidden.has(s.key)}
                  onClick={() => toggle(s.key)}
                  style={{ "--swatch": s.color } as CSSProperties}
                >
                  <span className={styles.swatch} data-kind={s.kind} />
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.view}>
          <Segmented label="Chart view" options={VIEWS} value={view} onChange={setView} />
        </div>
      </div>

      {showTable ? (
        <div className={styles.table}>
          <AnnualTable result={result} />
        </div>
      ) : (
        <div ref={boxRef} className={styles.plot} onPointerLeave={() => setHover(null)}>
          <svg
            className={styles.svg}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`${view === "annual" ? "Annual" : "Monthly"} revenue, EBITDA, profit, debt, equity and capital`}
          >
            {gridSteps.map((k) => (
              <g key={k}>
                <line
                  className={k === 0 ? styles.zero : styles.grid}
                  x1={PAD.left}
                  x2={width - right}
                  y1={yLine(k * lineStep)}
                  y2={yLine(k * lineStep)}
                />
                <text className={styles.yLabel} x={PAD.left - 8} y={yLine(k * lineStep)} dy="0.32em">
                  {tickLabel(k * lineStep)}
                </text>
                {dual ? (
                  <text className={styles.yLabelRight} x={width - right + 8} y={yBar(k * barStep)} dy="0.32em">
                    {tickLabel(k * barStep)}
                  </text>
                ) : null}
              </g>
            ))}
            {dual ? (
              <>
                <text className={styles.axisTitle} x={PAD.left - 8} y={PAD.top - 6}>
                  Balances
                </text>
                <text className={styles.yLabelRight} x={width - right + 8} y={PAD.top - 6}>
                  Per month
                </text>
              </>
            ) : null}

            {points.map((p, k) => (
              <g key={k}>
                {hover === k ? (
                  <rect className={styles.hoverBand} x={PAD.left + band * k} y={PAD.top} width={band} height={plotH} />
                ) : null}
                {bars.map((s, j) => {
                  const v = p.values[s.key];
                  const top = yBar(Math.max(0, v));
                  return (
                    <rect
                      key={s.key}
                      x={xCenter(k) - groupW / 2 + j * barW}
                      y={top}
                      width={Math.max(1, barW - (view === "annual" ? 2 : 0.5))}
                      height={Math.max(0, Math.min(PAD.top + plotH, yBar(Math.min(0, v))) - top)}
                      style={{ fill: s.color }}
                    />
                  );
                })}
                {p.axis ? (
                  <text className={styles.xLabel} x={xCenter(k)} y={height - PAD.bottom + 18}>
                    {p.axis}
                  </text>
                ) : null}
              </g>
            ))}

            {lines.map((s) => (
              <g key={s.key} style={{ stroke: s.color, fill: s.color }}>
                <polyline
                  className={styles.line}
                  points={points.map((p, k) => `${xCenter(k)},${yLine(p.values[s.key])}`).join(" ")}
                />
                {view === "annual"
                  ? points.map((p, k) => (
                      <circle key={k} className={styles.dot} cx={xCenter(k)} cy={yLine(p.values[s.key])} r={3} />
                    ))
                  : null}
              </g>
            ))}

            {points.map((_, k) => (
              <rect
                key={k}
                className={styles.hit}
                x={PAD.left + band * k}
                y={PAD.top}
                width={band}
                height={plotH}
                onPointerEnter={() => setHover(k)}
                onPointerDown={() => setHover(k)}
              />
            ))}
          </svg>

          {hovered ? (
            <div
              className={styles.tooltip}
              data-side={tipLeft > width / 2 ? "left" : "right"}
              style={{ left: tipLeft }}
              role="status"
            >
              <p className={styles.tipTitle}>{hovered.label}</p>
              <dl className={styles.tipList}>
                {[...bars, ...lines].map((s) => (
                  <div key={s.key} className={styles.tipRow} style={{ "--swatch": s.color } as CSSProperties}>
                    <dt>{s.label}</dt>
                    <dd>{usdShort(hovered.values[s.key], 2)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </div>
      )}
    </figure>
  );
}
