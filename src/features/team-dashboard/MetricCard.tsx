import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import type { MetricPoint } from "./metrics";
import styles from "./dashboard.module.css";

const DAY_MS = 24 * 60 * 60 * 1000;
const WIDTH = 300;
const HEIGHT = 72;
/** Room above and below the line, so its stroke isn't clipped at the extremes. */
const INSET = 4;

const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

const dayMs = (day: string): number => Date.parse(`${day}T00:00:00Z`);

/** Today's UTC day, which is the day the database stamps snapshots with. */
const todayUtc = (): string => new Date().toISOString().slice(0, 10);

/**
 * The metric's line over the range, placed by date so gaps in the history
 * show as straight runs, with the area under it shaded. Flat or single-point
 * series sit on the middle line.
 */
function Sparkline({ points, rangeDays, label }: { points: MetricPoint[]; rangeDays: number; label: string }): ReactElement {
  const end = dayMs(todayUtc());
  const start = end - (rangeDays - 1) * DAY_MS;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;

  const x = (day: string) => ((dayMs(day) - start) / Math.max(end - start, DAY_MS)) * WIDTH;
  const y = (value: number) => (span === 0 ? HEIGHT / 2 : INSET + (1 - (value - min) / span) * (HEIGHT - INSET * 2));
  const coords = points.map((point) => [x(point.day), y(point.value)] as const);
  const line = coords.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const area = coords.length
    ? `${line} L${coords.at(-1)![0].toFixed(1)},${HEIGHT} L${coords[0][0].toFixed(1)},${HEIGHT} Z`
    : "";

  return (
    <svg className={styles.spark} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={label}>
      {coords.length > 1 ? <path className={styles.sparkArea} d={area} /> : null}
      {coords.length > 1 ? <path className={styles.sparkLine} d={line} /> : null}
      {coords.length === 1 ? <path className={styles.sparkLine} d={`M0,${HEIGHT / 2} L${WIDTH},${HEIGHT / 2}`} /> : null}
    </svg>
  );
}

/**
 * One tracked figure: its value now, a secondary figure, how it moved over
 * the range and the line of its history. Links through to its app when the
 * viewer can open it.
 */
export function MetricCard({
  label,
  href,
  value,
  detail,
  points,
  rangeDays,
  format,
}: {
  label: string;
  href?: string;
  value: number;
  detail: ReactNode;
  points: MetricPoint[];
  rangeDays: number;
  /** The metric in its unit, e.g. "3.5 MW". */
  format: (value: number) => string;
}): ReactElement {
  const first = points[0];
  const last = points.at(-1);
  const delta = first && last ? last.value - first.value : 0;
  const since = first ? shortDate.format(new Date(dayMs(first.day))) : null;
  const trend = delta > 0 ? "up" : delta < 0 ? "down" : "flat";

  const body = (
    <>
      <div className={styles.cardHead}>
        <h2 className={styles.cardLabel}>{label}</h2>
        {href ? (
          <svg className={styles.cardArrow} viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6 3.5 10.5 8 6 12.5" />
          </svg>
        ) : null}
      </div>
      <p className={styles.value}>{format(value)}</p>
      <p className={styles.detail}>{detail}</p>
      <Sparkline
        points={points}
        rangeDays={rangeDays}
        label={
          first && last
            ? `${label} since ${since}: from ${format(first.value)} to ${format(last.value)}`
            : `${label}: no history yet`
        }
      />
      <p className={styles.change} data-trend={trend}>
        {since ? (
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
    </>
  );

  return href ? (
    <Link className={styles.card} href={href}>
      {body}
    </Link>
  ) : (
    <div className={styles.card}>{body}</div>
  );
}
