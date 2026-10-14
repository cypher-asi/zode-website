/**
 * The states slide's view of the policy tracker (db/schema.sql, read by
 * policy.ts), safe to hand to the client deck.
 */

/** A state's strongest statewide action, strongest first. */
export type StateStatus = "statewide" | "partial" | "pending" | "failed";

/** How a state's grid gates large loads: hookups halted or capped, or a commission's sign-off first. */
export type GridGate = "paused" | "signoff";

export interface PolicyState {
  status?: StateStatus;
  /** Each statewide action, as "instrument: note", strongest first. */
  actions: readonly string[];
  /** Local pauses in effect. */
  local: number;
  grid?: { gate: GridGate; note: string };
}

export interface PolicyMap {
  /** The latest snapshot's date, e.g. "October 13, 2026". */
  asOf: string;
  states: Readonly<Record<string, PolicyState>>;
  /** States whose legislature passed, is weighing or turned down a moratorium bill. */
  lawmakerStates: number;
  /** ERCOT's latest large-load queue and record peak, in GW. */
  ercotQueueGw: number | null;
  ercotPeakGw: number | null;
}

export const STATUS_ORDER: readonly StateStatus[] = ["statewide", "partial", "pending", "failed"];

export const STATUS_LABELS: Readonly<Record<StateStatus, string>> = {
  statewide: "Statewide pause in effect",
  partial: "State land or tax-break pause",
  pending: "Moratorium bill pending",
  failed: "Bill failed or vetoed",
};

export const GRID_LABELS: Readonly<Record<GridGate, string>> = {
  paused: "Grid hookups paused or capped",
  signoff: "State sign-off on large loads",
};
