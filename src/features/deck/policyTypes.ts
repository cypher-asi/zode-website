/**
 * The states slide's view of the policy tracker (db/schema.sql, read by
 * policy.ts), safe to hand to the client deck.
 */

/** A state's strongest statewide action, strongest first. */
export type StateStatus = "statewide" | "partial" | "pending" | "failed";

/** How a state's grid gates large loads: hookups halted or capped, or a commission's sign-off first. */
export type GridGate = "paused" | "signoff";

/** A legend entry: a statewide status, local pauses in effect, or a grid gate. */
export type PolicyKey = StateStatus | "local" | GridGate;

/** One tracked measure as the slide lists it. */
export interface PolicyMeasure {
  /** The tracker's key, e.g. "local:OH:brimfield-township"; it compresses where a uuid wouldn't. */
  id: string;
  /** The body and its instrument, e.g. "Governor · Executive Order 62", or a local pause's place. */
  title: string;
  note?: string;
  /** As "Jul 14, 2026". */
  adopted?: string;
  ends?: string;
  /** Its source, where the tracker has one. */
  url?: string;
}

/** A statewide bill or order. */
export interface StateAction extends PolicyMeasure {
  /** Where it stands, e.g. "Moratorium vetoed". */
  label: string;
  /** The map status it counts toward; none for one only proposed. */
  status?: StateStatus;
}

export interface PolicyState {
  status?: StateStatus;
  /** Statewide bills and orders, strongest first, then any only proposed. */
  actions: readonly StateAction[];
  /** How many local pauses are in effect; the pauses themselves come with LocalPauses. */
  localCount: number;
  grid?: PolicyMeasure & { gate: GridGate };
}

/**
 * Each state's local pauses in effect, by place. Most of the tracker by
 * weight and only needed once the slide's list opens, so the deck loads them
 * apart from the page (localPauses.ts).
 */
export type LocalPauses = Readonly<Record<string, readonly PolicyMeasure[]>>;

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

/** The legend, in order. */
export const LEGEND: readonly PolicyKey[] = [...STATUS_ORDER, "local", "paused", "signoff"];

export const LEGEND_LABELS: Readonly<Record<PolicyKey, string>> = {
  ...STATUS_LABELS,
  local: "Local pauses in effect",
  ...GRID_LABELS,
};
