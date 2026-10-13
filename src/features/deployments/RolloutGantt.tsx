import type { CSSProperties, ReactElement } from "react";
import { formatCount, formatDay, formatMw, plural } from "./format";
import { scheduleOf } from "./schedule";
import type { Phase } from "./types";
import styles from "./deployments.module.css";

const pct = (at: number): string => `${(at * 100).toFixed(3)}%`;

/** Month labels read rightward from their tick, so none starts this close to the axis's end. */
const LAST_LABEL_AT = 0.92;

/**
 * The rollout as a mini gantt: a bar per phase up to a diamond on its RFS
 * date, the next one to come marked in the accent, today as a hairline, and
 * a table of what each RFS brings and the running totals underneath.
 */
export function RolloutGantt({ phases, today }: { phases: readonly Phase[]; today: string }): ReactElement {
  const schedule = scheduleOf(phases, today);
  if (!schedule) return <p className={styles.muted}>No phases scheduled yet.</p>;

  return (
    <div className={styles.gantt}>
      <div className={styles.ganttChart} role="img" aria-label={`Rollout schedule, ${plural(phases.length, "phase")}`}>
        <div className={styles.ganttAxis} aria-hidden="true">
          <span />
          <div className={styles.ganttTrack}>
            {schedule.ticks
              .filter((tick) => tick.at < LAST_LABEL_AT)
              .map((tick) => (
                <span key={tick.at} className={styles.ganttTick} style={{ left: pct(tick.at) }}>
                  {tick.label}
                </span>
              ))}
          </div>
        </div>
        {schedule.rows.map((row, i) => (
          <div key={i} className={styles.ganttRow}>
            <div className={styles.ganttLabel}>
              <span className={styles.ganttName}>{row.label}</span>
              <span className={styles.ganttMeta}>
                {plural(row.phase.nodes, "node")} · {formatCount(row.gpus)} GPUs
                {row.phase.mw !== null ? ` · ${formatMw(row.phase.mw)}` : ""}
              </span>
            </div>
            <div className={styles.ganttTrack}>
              {schedule.ticks.map((tick) => (
                <span key={tick.at} className={styles.ganttGrid} style={{ left: pct(tick.at) }} />
              ))}
              {schedule.today !== null ? (
                <span className={styles.ganttToday} style={{ left: pct(schedule.today) }} />
              ) : null}
              <span
                className={styles.ganttBar}
                data-next={row.next ? "" : undefined}
                style={{ left: pct(row.start), width: pct(Math.max(row.rfs - row.start, 0)) }}
              />
              <span
                className={styles.ganttDiamond}
                data-next={row.next ? "" : undefined}
                style={{ left: pct(row.rfs) }}
              />
              <span
                className={styles.ganttDate}
                data-at={row.dateAt}
                style={{ "--from": pct(row.dateAt === "beforeBar" ? row.start : row.rfs) } as CSSProperties}
              >
                RFS {formatDay(row.phase.rfsOn)}
              </span>
            </div>
          </div>
        ))}
        {schedule.today !== null ? (
          <div className={styles.ganttLegend} aria-hidden="true">
            <span />
            <div className={styles.ganttTrack}>
              <span className={styles.ganttTodayLabel} style={{ left: pct(schedule.today) }}>
                Today
              </span>
            </div>
          </div>
        ) : null}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Phase</th>
              <th scope="col">RFS</th>
              <th scope="col">Nodes</th>
              <th scope="col">GPUs</th>
              <th scope="col">MW</th>
              <th scope="col">Cumulative GPUs</th>
              <th scope="col">Cumulative MW</th>
            </tr>
          </thead>
          <tbody>
            {schedule.rows.map((row, i) => (
              <tr key={i} data-next={row.next ? "" : undefined}>
                <th scope="row">{row.label}</th>
                <td>{formatDay(row.phase.rfsOn)}</td>
                <td>{formatCount(row.phase.nodes)}</td>
                <td>{formatCount(row.gpus)}</td>
                <td>{row.phase.mw !== null ? formatMw(row.phase.mw) : "—"}</td>
                <td>{formatCount(row.cumulativeGpus)}</td>
                <td>{formatMw(row.cumulativeMw)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
