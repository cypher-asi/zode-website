import type { CSSProperties, ReactElement, ReactNode } from "react";
import { DEMAND, sourceUrl, type Point, type SourceId } from "../research";
import styles from "./charts.module.css";

/** A note on the plot, linked to its source. */
function Cited({ id, children }: { id: SourceId; children: ReactNode }): ReactElement {
  return (
    <a className={styles.cited} href={sourceUrl(id)} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  );
}

const X0 = 2024;
const X1 = 2035;
const Y_MAX = 200;
const Y_TICKS = [0, 50, 100, 150, 200];

/**
 * The slide's wide plot, with the series and the gap named at its right
 * end, and a squarer one for a phone's story card, where the legend names
 * them and every other year is marked.
 */
const LAYOUTS = {
  wide: { W: 1000, H: 500, pad: { top: 20, right: 200, bottom: 40, left: 64 }, yearStep: 1 },
  compact: { W: 560, H: 540, pad: { top: 24, right: 12, bottom: 48, left: 92 }, yearStep: 2 },
} as const;

const [startYear, startGw] = DEMAND.installed[DEMAND.installed.length - 1];
const GRID: readonly Point[] = [
  [startYear, startGw],
  [X1, startGw + DEMAND.gridPace * (X1 - startYear)],
];
const FORECAST_END = DEMAND.forecast[DEMAND.forecast.length - 1][1];
const GRID_END = GRID[1][1];
/** The gap in 2035, which the compact chart leaves to its legend: its wedge is too narrow there to hold the label. */
export const DEMAND_GAP = FORECAST_END - GRID_END;
/** Where the gap's label sits: far enough right for the gap to be tall enough to hold it. */
const GAP_LABEL_YEAR = 2033.5;

/** A series' value at a year, read off the straight segments between its points. */
function at(points: readonly Point[], year: number): number {
  const i = Math.max(points.findIndex(([py]) => py >= year), 1);
  const [x0, y0] = points[i - 1];
  const [x1, y1] = points[i];
  return y0 + ((year - x0) / (x1 - x0)) * (y1 - y0);
}

/**
 * US data center capacity: installed, BNEF's base-case forecast, EPRI's 2030
 * range and S&P's 2030 estimate, against the installed base growing at the
 * grid's record annual connections (ZODE's illustration). The gap between
 * the forecast and that pace is the one accent.
 */
export function DemandChart({ active, compact = false }: { active: boolean; compact?: boolean }): ReactElement {
  const { W, H, pad: PAD, yearStep } = LAYOUTS[compact ? "compact" : "wide"];
  const x = (year: number) => PAD.left + ((year - X0) / (X1 - X0)) * (W - PAD.left - PAD.right);
  const y = (gw: number) => H - PAD.bottom - (gw / Y_MAX) * (H - PAD.top - PAD.bottom);
  const path = (points: readonly Point[]) =>
    points.map(([year, gw], i) => `${i ? "L" : "M"}${x(year).toFixed(1)},${y(gw).toFixed(1)}`).join(" ");
  const gapArea = `${path(DEMAND.forecast)} L${x(GRID[1][0])},${y(GRID_END)} L${x(GRID[0][0])},${y(GRID[0][1])} Z`;
  const years = Array.from({ length: X1 - X0 + 1 }, (_, i) => X0 + i).filter((_, i) => i % yearStep === 0);
  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${W} ${H}`}
      data-active={active || undefined}
      data-compact={compact || undefined}
      role="img"
      aria-label={`US data center capacity: ${startGw} GW installed at the end of 2025, forecast by BNEF to reach 118 GW in 2030 and ${FORECAST_END} GW in 2035, against ${GRID_END} GW if the grid kept connecting a record 10 GW a year.`}
    >
      {Y_TICKS.map((tick) => (
        <g key={tick}>
          <line className={styles.grid} x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} />
          <text className={styles.axis} x={PAD.left - 12} y={y(tick)} dy="0.35em" textAnchor="end">
            {tick === 0 ? "0" : `${tick} GW`}
          </text>
        </g>
      ))}
      {years.map((year) => (
        <text key={year} className={styles.axis} x={x(year)} y={H - PAD.bottom + (compact ? 32 : 24)} textAnchor="middle">
          {year}
        </text>
      ))}

      <path className={styles.gap} d={gapArea} />

      <rect
        className={styles.range}
        x={x(2030) - 9}
        width={18}
        y={y(DEMAND.epri2030.high)}
        height={y(DEMAND.epri2030.low) - y(DEMAND.epri2030.high)}
      />
      {/* The squarer plot has room under the range and left of the marker, where the lines aren't. */}
      <Cited id="epri">
        <text
          className={styles.note}
          x={compact ? x(2030) : x(2030) - 18}
          y={y(DEMAND.epri2030.low)}
          dy={compact ? "1.4em" : "-0.2em"}
          textAnchor={compact ? "middle" : "end"}
        >
          EPRI 2030: {DEMAND.epri2030.low}–{DEMAND.epri2030.high} GW
        </text>
      </Cited>

      <circle className={styles.marker} cx={x(2030)} cy={y(DEMAND.sp2030)} r={6} />
      <Cited id="utilityDive">
        <text
          className={styles.note}
          x={compact ? x(2030) - 14 : x(2030) + 14}
          y={y(DEMAND.sp2030)}
          dy="0.35em"
          textAnchor={compact ? "end" : "start"}
        >
          S&amp;P 2030: {DEMAND.sp2030}+ GW
        </text>
      </Cited>

      <path className={styles.dashed} d={path(GRID)} />
      <path className={styles.line} d={path(DEMAND.forecast)} pathLength={1} />
      <path className={styles.installed} d={path(DEMAND.installed)} pathLength={1} />

      {DEMAND.forecast.slice(1).map(([year, gw], i) => (
        <g key={year} className={styles.pop} style={{ "--d": i + 1 } as CSSProperties}>
          <circle className={styles.dot} cx={x(year)} cy={y(gw)} r={5} />
          <text className={styles.value} x={x(year) - 12} y={y(gw)} dy="-0.6em" textAnchor="end">
            {gw} GW
          </text>
        </g>
      ))}
      <circle className={styles.dot} cx={x(startYear)} cy={y(startGw)} r={5} />

      {compact ? null : (
        <g className={styles.pop} style={{ "--d": 3 } as CSSProperties}>
          <text className={styles.series} x={W - PAD.right + 16} y={y(FORECAST_END)} dy="0.35em">
            Forecast demand
          </text>
          <Cited id="bnef">
            <text className={styles.seriesNote} x={W - PAD.right + 16} y={y(FORECAST_END)} dy="1.9em">
              BNEF base case
            </text>
          </Cited>
          <text className={styles.series} x={W - PAD.right + 16} y={y(GRID_END)} dy="0.35em">
            Grid at record pace
          </text>
          <text className={styles.seriesNote} x={W - PAD.right + 16} y={y(GRID_END)} dy="1.9em">
            {GRID_END} GW · illustrative
          </text>
          <text
            className={styles.gapLabel}
            x={x(GAP_LABEL_YEAR)}
            y={(y(at(DEMAND.forecast, GAP_LABEL_YEAR)) + y(at(GRID, GAP_LABEL_YEAR))) / 2}
            dy="0.35em"
            textAnchor="middle"
          >
            {DEMAND_GAP} GW gap
          </text>
        </g>
      )}
    </svg>
  );
}
