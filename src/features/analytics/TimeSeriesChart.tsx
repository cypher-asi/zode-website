"use client";

import { useRef, useState, type PointerEvent, type ReactElement } from "react";
import { formatValue, type Unit } from "./format";
import styles from "./analytics.module.css";

export interface ChartPoint {
  /** Axis label, e.g. "Oct 13" or "3 PM". */
  tick: string;
  /** Tooltip title, e.g. "Tue, Oct 13, 2026". */
  title: string;
  /** `null` for buckets still to come in the period. */
  value: number | null;
}

const WIDTH = 1000;
const HEIGHT = 220;
const TICKS = 6;

/** A round number at or above `value`, for the top of the axis. */
function niceMax(value: number, unit: Unit): number {
  if (value <= 0) return unit === "percent" ? 1 : unit === "duration" ? 60_000 : 4;
  const exp = 10 ** Math.floor(Math.log10(value));
  const fraction = value / exp;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  const max = nice * exp;
  return unit === "count" ? Math.max(4, Math.ceil(max)) : max;
}

/** An SVG path through the points, broken wherever a value is missing. */
function pathOf(values: (number | null)[], x: (i: number) => number, y: (v: number) => number): string {
  let d = "";
  let drawing = false;
  values.forEach((value, i) => {
    if (value === null) {
      drawing = false;
      return;
    }
    d += `${drawing ? "L" : "M"}${x(i).toFixed(1)},${y(value).toFixed(1)} `;
    drawing = true;
  });
  return d.trim();
}

/**
 * The period's trend with the previous period dashed beneath it, aligned
 * bucket for bucket. Hovering shows both values for the bucket under the
 * pointer.
 */
export function TimeSeriesChart({
  title,
  unit,
  points,
  previous,
}: {
  title: string;
  unit: Unit;
  points: ChartPoint[];
  previous: (number | null)[];
}): ReactElement {
  const plot = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const count = Math.max(points.length, previous.length, 1);
  const values = points.map((point) => point.value);
  const all = [...values, ...previous].filter((value): value is number => value !== null);
  const max = niceMax(Math.max(0, ...all), unit);
  const x = (i: number) => (count === 1 ? WIDTH / 2 : (i / (count - 1)) * WIDTH);
  const y = (value: number) => HEIGHT - (value / max) * HEIGHT;

  const line = pathOf(values, x, y);
  const lastIndex = values.reduce<number>((last, value, i) => (value === null ? last : i), -1);
  const firstIndex = values.findIndex((value) => value !== null);
  const area =
    line && firstIndex >= 0 && !values.slice(firstIndex, lastIndex + 1).includes(null)
      ? `${line} L${x(lastIndex).toFixed(1)},${HEIGHT} L${x(firstIndex).toFixed(1)},${HEIGHT} Z`
      : "";
  const previousLine = pathOf(previous, x, y);

  const gridValues = unit === "count" && max % 2 !== 0 ? [0, max] : [0, max / 2, max];
  const tickEvery = Math.max(1, Math.ceil(points.length / TICKS));
  const ticks = points
    .map((point, i) => ({ i, label: point.tick }))
    .filter(({ i }) => i % tickEvery === 0 || i === points.length - 1)
    .filter(({ i }, k, list) => k === list.length - 1 || list[list.length - 1].i - i >= tickEvery / 2);

  function onMove(event: PointerEvent<HTMLDivElement>) {
    const box = plot.current?.getBoundingClientRect();
    if (!box || !box.width) return;
    const ratio = Math.min(Math.max((event.clientX - box.left) / box.width, 0), 1);
    setHover(Math.round(ratio * (count - 1)));
  }

  const hovered = hover === null ? null : { point: points[hover], previous: previous[hover] ?? null, i: hover };
  const left = (i: number) => `${(x(i) / WIDTH) * 100}%`;

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHead}>
        <h2 className={styles.chartTitle}>{title}</h2>
        <div className={styles.legend}>
          <span>This period</span>
          <span className={styles.legendPrevious}>Previous period</span>
        </div>
      </div>
      <div
        ref={plot}
        className={styles.plot}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`${title}: ${points
          .filter((point) => point.value !== null)
          .map((point) => `${point.title} ${formatValue(point.value, unit)}`)
          .slice(-14)
          .join(", ")}`}
      >
        {gridValues.map((value) => (
          <span key={value} className={styles.yLabel} style={{ top: `${(y(value) / HEIGHT) * 100}%` }}>
            {formatValue(value, unit, { short: true })}
          </span>
        ))}
        <svg className={styles.chart} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
          {gridValues.map((value) => (
            <line key={value} className={styles.gridLine} x1={0} x2={WIDTH} y1={y(value)} y2={y(value)} />
          ))}
          {previousLine ? <path className={styles.previousLine} d={previousLine} /> : null}
          {area ? <path className={styles.area} d={area} /> : null}
          {line ? <path className={styles.line} d={line} /> : null}
          {hovered ? <line className={styles.cursor} x1={x(hovered.i)} x2={x(hovered.i)} y1={0} y2={HEIGHT} /> : null}
        </svg>
        {hovered?.point?.value != null ? (
          <span className={styles.dot} style={{ left: left(hovered.i), top: `${(y(hovered.point.value) / HEIGHT) * 100}%` }} />
        ) : null}
        {hovered ? (
          <div
            className={styles.tooltip}
            style={
              x(hovered.i) > WIDTH * 0.6
                ? { right: `calc(${100 - (x(hovered.i) / WIDTH) * 100}% + 12px)` }
                : { left: `calc(${left(hovered.i)} + 12px)` }
            }
          >
            <div className={styles.tooltipTitle}>{hovered.point?.title ?? "Previous period"}</div>
            <div className={styles.tooltipRow}>
              <span>This period</span>
              <span>{formatValue(hovered.point?.value ?? null, unit)}</span>
            </div>
            <div className={styles.tooltipRow}>
              <span>Previous</span>
              <span>{formatValue(hovered.previous, unit)}</span>
            </div>
          </div>
        ) : null}
      </div>
      <div className={styles.xAxis} aria-hidden="true">
        {ticks.map(({ i, label }) => (
          <span key={i} className={styles.xLabel} style={{ left: left(i) }}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
