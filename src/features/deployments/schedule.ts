import { dayOf, formatMonth, formatMonthYear } from "./format";
import { gpusFor, type Phase } from "./types";

/*
 * The rollout as a mini gantt: one row per phase, its bar running from its
 * start to its RFS date, on a month axis padded out to whole months. Positions
 * are fractions of the axis, 0 to 1, so the page and the PDF draw the same
 * chart at their own sizes.
 */

const DAY_MS = 86_400_000;
/** How far before its RFS a phase with no start, and no phase before it, is drawn to begin. */
const DEFAULT_LEAD_DAYS = 90;
/** Past this point on the axis an RFS date no longer fits after its diamond... */
const DATE_AFTER_UNTIL = 0.8;
/** ...and reads before the bar instead, if the bar starts at least this far along. */
const DATE_ROOM = 0.3;

export interface ScheduleRow {
  phase: Phase;
  label: string;
  gpus: number;
  start: number;
  rfs: number;
  /**
   * Where the RFS date reads: after the diamond, or near the axis's end
   * before the bar, or over the bar when the bar leaves no room before it.
   */
  dateAt: "after" | "beforeBar" | "overBar";
  /** The first phase still to come. */
  next: boolean;
  cumulativeNodes: number;
  cumulativeGpus: number;
  cumulativeMw: number;
}

export interface ScheduleTick {
  at: number;
  label: string;
}

export interface Schedule {
  rows: ScheduleRow[];
  ticks: ScheduleTick[];
  /** Where today falls, when it's on the axis. */
  today: number | null;
}

const firstOfMonth = (date: Date, offset = 0): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));

/** `phases` in RFS order; `today` as `YYYY-MM-DD`. */
export function scheduleOf(phases: readonly Phase[], today: string): Schedule | null {
  if (!phases.length) return null;

  const spans = phases.map((phase, i) => {
    const rfs = dayOf(phase.rfsOn).getTime();
    const start = phase.startOn
      ? dayOf(phase.startOn).getTime()
      : i > 0
        ? Math.min(dayOf(phases[i - 1].rfsOn).getTime(), rfs)
        : rfs - DEFAULT_LEAD_DAYS * DAY_MS;
    return { start, rfs };
  });

  const axisStart = firstOfMonth(new Date(Math.min(...spans.map((s) => s.start))));
  const axisEnd = firstOfMonth(new Date(Math.max(...spans.map((s) => s.rfs))), 1);
  const span = axisEnd.getTime() - axisStart.getTime();
  const at = (time: number): number => (time - axisStart.getTime()) / span;

  const months = Math.round(span / (30.44 * DAY_MS));
  const step = months <= 8 ? 1 : months <= 18 ? 2 : months <= 36 ? 3 : 6;
  const ticks: ScheduleTick[] = [];
  for (let i = 0; i <= months; i += step) {
    const date = firstOfMonth(axisStart, i);
    if (date.getTime() > axisEnd.getTime()) break;
    ticks.push({
      at: at(date.getTime()),
      label: i === 0 || date.getUTCMonth() === 0 ? formatMonthYear(date) : formatMonth(date),
    });
  }

  const nextIndex = phases.findIndex((phase) => phase.rfsOn >= today);
  let nodes = 0;
  let mw = 0;
  const rows = phases.map((phase, i): ScheduleRow => {
    nodes += phase.nodes;
    mw += phase.mw ?? 0;
    const start = at(spans[i].start);
    const rfs = at(spans[i].rfs);
    return {
      phase,
      label: phase.name || `Phase ${i + 1}`,
      gpus: gpusFor(phase.nodes),
      start,
      rfs,
      dateAt: rfs <= DATE_AFTER_UNTIL ? "after" : start >= DATE_ROOM ? "beforeBar" : "overBar",
      next: i === nextIndex,
      cumulativeNodes: nodes,
      cumulativeGpus: gpusFor(nodes),
      cumulativeMw: mw,
    };
  });

  const now = at(dayOf(today).getTime());
  return { rows, ticks, today: now >= 0 && now <= 1 ? now : null };
}
