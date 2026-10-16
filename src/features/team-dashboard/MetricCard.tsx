import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import type { MetricPoint } from "./metrics";
import { SPARK_HEIGHT as HEIGHT, SPARK_WIDTH as WIDTH } from "./spark";
import { Sparkline, type SparkDay, type SparkWeek } from "./Sparkline";
import styles from "./dashboard.module.css";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Room above and below the line, so its stroke isn't clipped at the extremes. */
const INSET = 4;

const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const dayTitle = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const dayTitleWithYear = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const dayMs = (day: string): number => Date.parse(`${day}T00:00:00Z`);

/** Today's UTC day, which is the day the database stamps snapshots with. */
const todayUtc = (): string => new Date().toISOString().slice(0, 10);

/**
 * The metric's line over the range, placed by date so gaps in the history
 * show as straight runs, with the area under it shaded. Before the first
 * snapshot in the range a dashed lead-in holds its value, so a metric tracked
 * only since today doesn't read as a year of history. A history that starts
 * at zero was zero before it too, so its line runs solid from the start of the
 * range instead. A flat series sits mid height, or on the floor when it's zero.
 *
 * Also each day of the range for the hover: its figure, carried over from the
 * last snapshot across a gap, and where the line crosses it. With `weekly`,
 * Monday-to-Sunday weeks and the sum of their days, for figures counted per
 * day.
 */
function sparkline(
  history: MetricPoint[],
  rangeDays: number,
  format: (value: number) => string,
  weekly: boolean,
): { line: string; area: string; leadIn: string | null; days: SparkDay[]; weeks?: SparkWeek[] } {
  const end = dayMs(todayUtc());
  const start = end - (rangeDays - 1) * DAY_MS;
  const points =
    history[0]?.value === 0 && dayMs(history[0].day) > start
      ? [{ day: new Date(start).toISOString().slice(0, 10), value: 0 }, ...history]
      : history;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;

  const x = (day: string) => ((dayMs(day) - start) / Math.max(end - start, DAY_MS)) * WIDTH;
  const y = (value: number) =>
    span === 0
      ? value === 0
        ? HEIGHT - INSET
        : HEIGHT / 2
      : INSET + (1 - (value - min) / span) * (HEIGHT - INSET * 2);
  const coords = points.map((point) => [x(point.day), y(point.value)] as const);
  if (coords.length === 1) coords.push([WIDTH, coords[0][1]]);
  const line = coords.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const area = coords.length
    ? `${line} L${coords.at(-1)![0].toFixed(1)},${HEIGHT} L${coords[0][0].toFixed(1)},${HEIGHT} Z`
    : "";
  const [firstX, firstY] = coords[0] ?? [0, 0];
  const leadIn = firstX > 1 ? `M0,${firstY.toFixed(1)} L${firstX.toFixed(1)},${firstY.toFixed(1)}` : null;

  const thisYear = new Date(end).getUTCFullYear();
  const lastX = coords.at(-1)?.[0] ?? -1;
  const days: SparkDay[] = [];
  let next = 0;
  for (let i = 0; i < rangeDays; i++) {
    const ms = start + i * DAY_MS;
    const date = new Date(ms);
    const title = (date.getUTCFullYear() === thisYear ? dayTitle : dayTitleWithYear).format(date);
    const at = ((ms - start) / Math.max(end - start, DAY_MS)) * WIDTH;
    while (next < points.length && dayMs(points[next].day) <= ms) next++;
    const before = points[next - 1];
    if (!before) {
      days.push({ title, value: "No history yet", y: null });
    } else if (at > lastX + 0.01) {
      days.push({ title, value: "No data yet", y: null });
    } else {
      const after = points[next];
      const [bx, by] = [x(before.day), y(before.value)];
      const ay = after ? y(after.value) : by;
      const ax = after ? x(after.day) : bx;
      days.push({ title, value: format(before.value), y: ax > bx ? by + ((at - bx) / (ax - bx)) * (ay - by) : by });
    }
  }

  if (!weekly) return { line, area, leadIn, days };
  const byDay = new Map(history.map((point) => [point.day, point.value]));
  const dateAt = (i: number) => new Date(start + i * DAY_MS);
  const ranges: { start: number; end: number; total: number }[] = [];
  for (let i = 0; i < rangeDays; i++) {
    if (i === 0 || dateAt(i).getUTCDay() === 1) ranges.push({ start: i, end: i, total: 0 });
    const week = ranges.at(-1)!;
    week.end = i;
    week.total += byDay.get(dateAt(i).toISOString().slice(0, 10)) ?? 0;
  }
  const weeks = ranges.map((week) => ({
    start: week.start,
    end: week.end,
    title: shortDate.formatRange(dateAt(week.start), dateAt(week.end)),
    total: format(week.total),
  }));
  return { line, area, leadIn, days, weeks };
}

/**
 * One tracked figure: its value now, a secondary figure, how it moved over
 * the range and the line of its history, which shows each day's figure on
 * hover. Links through to its app when the viewer can open it.
 */
export function MetricCard({
  label,
  href,
  value,
  detail,
  points,
  rangeDays,
  format,
  change,
  weekly = false,
}: {
  label: string;
  href?: string;
  value: number;
  detail: ReactNode;
  points: MetricPoint[];
  rangeDays: number;
  /** The metric in its unit, e.g. "3.5 MW". */
  format: (value: number) => string;
  /** Replaces the change since the first point, for figures that aren't a running total, e.g. visitors per day. */
  change?: { text: ReactNode; trend: "up" | "down" | "flat" };
  /** Lets the line pick out a week at a time and total it, for figures counted per day. */
  weekly?: boolean;
}): ReactElement {
  const first = points[0];
  const last = points.at(-1);
  const delta = first && last ? last.value - first.value : 0;
  const since = first ? shortDate.format(new Date(dayMs(first.day))) : null;
  const trend = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const head = (
    <>
      <h2 className={styles.cardLabel}>{label}</h2>
      {href ? (
        <svg className={styles.cardArrow} viewBox="0 0 16 16" aria-hidden="true">
          <path d="M6 3.5 10.5 8 6 12.5" />
        </svg>
      ) : null}
    </>
  );

  return (
    <div className={styles.card}>
      {href ? (
        <Link className={`${styles.cardHead} ${styles.cardLink}`} href={href}>
          {head}
        </Link>
      ) : (
        <div className={styles.cardHead}>{head}</div>
      )}
      <p className={styles.value}>{format(value)}</p>
      <p className={styles.detail}>{detail}</p>
      <Sparkline
        {...sparkline(points, rangeDays, format, weekly)}
        metric={label}
        href={href}
        label={
          first && last
            ? `${label} since ${since}: from ${format(first.value)} to ${format(last.value)}`
            : `${label}: no history yet`
        }
      />
      <p className={styles.change} data-trend={change?.trend ?? trend}>
        {change ? (
          change.text
        ) : since ? (
          <>
            <span className={styles.delta}>
              {delta === 0 ? "No change" : `${delta > 0 ? "+" : "−"}${format(Math.abs(delta))}`}
            </span>{" "}
            since {since}
          </>
        ) : (
          "No history yet"
        )}
      </p>
    </div>
  );
}
