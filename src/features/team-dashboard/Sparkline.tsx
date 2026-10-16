"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import styles from "./dashboard.module.css";

export const SPARK_WIDTH = 300;
export const SPARK_HEIGHT = 72;

export interface SparkDay {
  /** e.g. "Tue, Oct 13". */
  title: string;
  /** The day's figure in its unit, or why there isn't one. */
  value: string;
  /** Where the line crosses the day, in viewBox units; `null` off the line. */
  y: number | null;
}

export interface SparkWeek {
  /** Indexes into the days, inclusive. */
  start: number;
  end: number;
  /** e.g. "Oct 5 – 11". */
  title: string;
  total: string;
}

/**
 * A metric card's line, one day per step across the range. Hovering snaps to
 * the day under the pointer and shows its figure. With `weeks`, a click picks
 * the hovered day's week and the arrow keys step it back and forth; without,
 * a click follows `href`, as the rest of the card does.
 */
export function Sparkline({
  label,
  metric,
  href,
  line,
  area,
  leadIn,
  days,
  weeks,
}: {
  label: string;
  /** Names the day's figure in the tooltip, e.g. "Visitors". */
  metric: string;
  href?: string;
  line: string;
  area: string;
  leadIn: string | null;
  days: SparkDay[];
  weeks?: SparkWeek[];
}): ReactElement {
  const router = useRouter();
  const plot = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const step = SPARK_WIDTH / Math.max(days.length - 1, 1);
  const x = (i: number) => i * step;
  const percent = (value: number, of: number) => `${(value / of) * 100}%`;
  const weekOf = (i: number) => weeks?.findIndex((week) => i >= week.start && i <= week.end) ?? -1;

  function dayAt(event: PointerEvent<HTMLDivElement>): number | null {
    const box = plot.current?.getBoundingClientRect();
    if (!box || !box.width) return null;
    const ratio = Math.min(Math.max((event.clientX - box.left) / box.width, 0), 1);
    return Math.round(ratio * (days.length - 1));
  }

  function onClick() {
    if (!weeks) {
      if (href) router.push(href);
      return;
    }
    if (hover === null) return;
    const week = weekOf(hover);
    setSelected(week === selected ? null : week);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!weeks?.length) return;
    const last = weeks.length - 1;
    const current = selected ?? last + 1;
    const next =
      event.key === "ArrowLeft"
        ? Math.max(current - 1, 0)
        : event.key === "ArrowRight"
          ? Math.min(current + 1, last)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (event.key === "Escape") setSelected(null);
    if (next === null) return;
    event.preventDefault();
    setHover(null);
    setSelected(next);
  }

  const week = selected === null ? null : (weeks?.[selected] ?? null);
  const hoveredWeek = hover === null ? null : (weeks?.[weekOf(hover)] ?? null);
  const anchor = hover ?? week?.end ?? null;
  const day = hover === null ? null : days[hover];

  return (
    <div
      ref={plot}
      className={styles.sparkPlot}
      data-weekly={weeks ? "" : undefined}
      data-link={!weeks && href ? "" : undefined}
      onPointerMove={(event) => setHover(dayAt(event))}
      onPointerDown={(event) => setHover(dayAt(event))}
      onPointerLeave={() => setHover(null)}
      onClick={onClick}
      {...(weeks
        ? {
            role: "slider",
            tabIndex: 0,
            onKeyDown,
            "aria-label": `${label}, week by week`,
            "aria-valuemin": 0,
            "aria-valuemax": Math.max(weeks.length - 1, 0),
            "aria-valuenow": selected ?? Math.max(weeks.length - 1, 0),
            "aria-valuetext": week ? `${week.title}: ${week.total}` : "No week selected",
          }
        : { role: "img", "aria-label": label })}
    >
      <svg className={styles.spark} viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
        {week ? (
          <rect
            className={styles.sparkWeek}
            x={Math.max(x(week.start) - step / 2, 0)}
            width={Math.min(x(week.end) + step / 2, SPARK_WIDTH) - Math.max(x(week.start) - step / 2, 0)}
            y={0}
            height={SPARK_HEIGHT}
          />
        ) : null}
        {area ? <path className={styles.sparkArea} d={area} /> : null}
        {leadIn ? <path className={styles.sparkLeadIn} d={leadIn} /> : null}
        {line ? <path className={styles.sparkLine} d={line} /> : null}
        {hover !== null ? (
          <line className={styles.sparkCursor} x1={x(hover)} x2={x(hover)} y1={0} y2={SPARK_HEIGHT} />
        ) : null}
      </svg>
      {day?.y != null ? (
        <span
          className={styles.sparkDot}
          style={{ left: percent(x(hover!), SPARK_WIDTH), top: percent(day.y, SPARK_HEIGHT) }}
        />
      ) : null}
      {anchor !== null && (day || week) ? (
        <div
          className={styles.sparkTooltip}
          style={
            x(anchor) > SPARK_WIDTH * 0.6
              ? { right: `calc(${100 - (x(anchor) / SPARK_WIDTH) * 100}% + 12px)` }
              : { left: `calc(${percent(x(anchor), SPARK_WIDTH)} + 12px)` }
          }
        >
          {day ? (
            <>
              <div className={styles.sparkTooltipTitle}>{day.title}</div>
              <div className={styles.sparkTooltipRow}>
                <span>{metric}</span>
                <span>{day.value}</span>
              </div>
              {hoveredWeek ? (
                <div className={styles.sparkTooltipRow}>
                  <span>{hoveredWeek.title}</span>
                  <span>{hoveredWeek.total}</span>
                </div>
              ) : null}
            </>
          ) : week ? (
            <>
              <div className={styles.sparkTooltipTitle}>{week.title}</div>
              <div className={styles.sparkTooltipRow}>
                <span>{metric}</span>
                <span>{week.total}</span>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
