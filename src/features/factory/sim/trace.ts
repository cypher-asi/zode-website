import type { FlowPos, Scenario } from "../model/catalog";

/*
 * Everything a run did, recorded so any moment can be looked up afterwards:
 * the view and the stats are pure functions of (trace, time), which is what
 * lets the playhead scrub freely. Times are hours from the start of the run.
 */

/** What a station is doing: no pod, waiting on its kit, waiting on the crane, building, or done but unable to pass the pod on. */
export const STATES = ["idle", "parts", "crane", "working", "blocked"] as const;
export type StationState = (typeof STATES)[number];
export const IDLE = 0;
export const PARTS = 1;
export const CRANE = 2;
export const WORKING = 3;
export const BLOCKED = 4;

export const STATE_LABELS: Record<StationState, string> = {
  idle: "Waiting for a pod",
  parts: "Waiting for parts",
  crane: "Waiting for the crane",
  working: "Working",
  blocked: "Blocked downstream",
};

/** Position index of the receiving dock, before the line. The yard is `flow.length`. */
export const RECEIVING = -1;

export interface Move {
  from: number;
  to: number;
  t0: number;
  t1: number;
}

export interface PodTrace {
  /** Serial number, from 1. */
  id: number;
  released: number;
  /** In order; the first leaves receiving, the last (once done) reaches the yard. */
  moves: Move[];
  /** Per station: when its work on this pod started and ends, NaN if not reached. */
  start: number[];
  end: number[];
  reworked: boolean[];
  /** Arrival in the yard, NaN if still on the floor when the run ends. */
  done: number;
}

/** A station's state changes, with the hours spent in each state before each change. */
export interface StateSeries {
  t: number[];
  state: number[];
  /** `STATES.length` totals per change, flattened. */
  cum: number[];
}

export interface StockSeries {
  t: number[];
  onHand: number[];
}

/** A kit carted from the store to a station's pad, then used when the station starts a pod. */
export interface KitTrip {
  station: number;
  t0: number;
  t1: number;
  used: number;
}

export interface CraneLift {
  station: number;
  t0: number;
  t1: number;
}

export interface Trace {
  scenario: Scenario;
  flow: FlowPos[];
  horizon: number;
  pods: PodTrace[];
  releases: number[];
  /** When each pod entered the line, in pod order (the line is first in, first out). */
  starts: number[];
  /** Completion times in order, with running totals of lead time (from release) and build time (from entering the line). */
  doneTimes: number[];
  leadSum: number[];
  buildSum: number[];
  stations: StateSeries[];
  /** Per station, sorted times its work on a pod ended. */
  stationEnds: number[][];
  stock: StockSeries[];
  orderUpTo: number[];
  kits: KitTrip[];
  crane: CraneLift[];
}

/** Index of the last element of ascending `a` at or before `t`, or -1. */
export function lastAtOrBefore(a: readonly number[], t: number): number {
  let lo = 0;
  let hi = a.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (a[mid] <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

const countBy = (a: readonly number[], t: number) => lastAtOrBefore(a, t) + 1;

/** Where a pod is: on its way from `from` to `to`, `u` of the way there (1 once arrived). Null before it enters the line. */
export interface PodPlace {
  from: number;
  to: number;
  u: number;
}

export function podPlace(pod: PodTrace, t: number): PodPlace | null {
  const moves = pod.moves;
  let lo = 0;
  let hi = moves.length - 1;
  let i = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (moves[mid].t0 <= t) {
      i = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (i < 0) return null;
  const m = moves[i];
  const u = t >= m.t1 || m.t1 <= m.t0 ? 1 : (t - m.t0) / (m.t1 - m.t0);
  return { from: m.from, to: m.to, u };
}

/** How many pods have entered the line by `t`; they're `trace.pods[0..n)`, newest last. */
export function podsStarted(trace: Trace, t: number): number {
  return countBy(trace.starts, t);
}

export function stationStateAt(series: StateSeries, t: number): number {
  const i = lastAtOrBefore(series.t, t);
  return series.state[Math.max(0, i)];
}

/** Share of the time up to `t` a station spent in each state. */
export function stationShares(series: StateSeries, t: number): number[] {
  const k = STATES.length;
  const i = Math.max(0, lastAtOrBefore(series.t, t));
  const totals = series.cum.slice(i * k, i * k + k);
  totals[series.state[i]] += Math.max(0, t - series.t[i]);
  const sum = totals.reduce((a, b) => a + b, 0);
  return sum > 0 ? totals.map((v) => v / sum) : totals.map((_, s) => (s === IDLE ? 1 : 0));
}

export function stockAt(series: StockSeries, t: number): number {
  return series.onHand[Math.max(0, lastAtOrBefore(series.t, t))];
}

export interface StationStats {
  state: number;
  shares: number[];
  /** Pods it has finished. */
  processed: number;
}

export interface FloorStats {
  t: number;
  completed: number;
  /** Pods finished in the last seven days (or since the start, if sooner). */
  lastWeek: number;
  /** Mean hours from release to the yard, and from entering the line to the yard. */
  leadHours: number | null;
  buildHours: number | null;
  /** Pods on the line. */
  wip: number;
  /** Orders released but not yet started. */
  backlog: number;
  stations: StationStats[];
  stock: number[];
  /** The station that has spent the most time working, once there's enough history to tell. */
  bottleneck: number | null;
}

export function statsAt(trace: Trace, t: number): FloorStats {
  const completed = countBy(trace.doneTimes, t);
  const weekAgo = completed - countBy(trace.doneTimes, t - 168);
  const started = countBy(trace.starts, t);
  const stations = trace.stations.map((series, i) => ({
    state: stationStateAt(series, t),
    shares: stationShares(series, t),
    processed: countBy(trace.stationEnds[i], t),
  }));
  let bottleneck: number | null = null;
  if (t >= 48) {
    bottleneck = 0;
    stations.forEach((s, i) => {
      if (s.shares[WORKING] > stations[bottleneck!].shares[WORKING]) bottleneck = i;
    });
  }
  return {
    t,
    completed,
    lastWeek: weekAgo,
    leadHours: completed ? trace.leadSum[completed - 1] / completed : null,
    buildHours: completed ? trace.buildSum[completed - 1] / completed : null,
    wip: started - completed,
    backlog: countBy(trace.releases, t) - started,
    stations,
    stock: trace.stock.map((s) => stockAt(s, t)),
    bottleneck,
  };
}

/** The pod at a station at `t` (arrived or arriving), as an index into `trace.pods`, or -1. */
export function podAtStation(trace: Trace, station: number, t: number): number {
  const pos = trace.flow.findIndex((f) => f.kind === "station" && f.station === station);
  for (let i = podsStarted(trace, t) - 1; i >= 0; i--) {
    const place = podPlace(trace.pods[i], t);
    if (!place) continue;
    if (place.to === pos) return i;
    // Pods further back in the list entered earlier, so they're further along.
    if (place.to > pos && place.from >= pos) break;
  }
  return -1;
}
