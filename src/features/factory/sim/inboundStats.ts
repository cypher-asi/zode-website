import type { InboundConfig } from "../model/inbound";
import {
  DAMAGED,
  REJECTED,
  RESOURCES,
  STOCKED,
  type HuTrace,
  type InboundTrace,
  type Resource,
  type TruckTrace,
} from "./inbound";

/*
 * The receiving dock at any moment, read from its trace: where each truck and
 * HU is, and the dock's figures so far. Like the line's stats, pure functions
 * of (trace, time).
 */

export const TRUCK_PHASES = [
  "enroute",
  "gate",
  "holding",
  "stall",
  "docking",
  "unloading",
  "paperwork",
  "departing",
  "gone",
] as const;
export type TruckPhase = (typeof TRUCK_PHASES)[number];

export const TRUCK_PHASE_LABELS: Record<TruckPhase, string> = {
  enroute: "On the way",
  gate: "At the gate",
  holding: "Holding at the gate",
  stall: "In the yard",
  docking: "Docking",
  unloading: "Unloading",
  paperwork: "Checks and BOL",
  departing: "Pulling out",
  gone: "Left",
};

export function truckPhase(tr: TruckTrace, t: number): TruckPhase {
  if (t < tr.arrive) return "enroute";
  if (t < tr.gateIn) return "gate";
  if (t < tr.stallAt) return "holding";
  if (t < tr.docked) return "stall";
  if (t < tr.ready) return "docking";
  if (t < tr.unloadEnd) return "unloading";
  if (t < tr.released) return "paperwork";
  if (t < tr.departed) return "departing";
  return "gone";
}

export const HU_PHASES = [
  "truck",
  "unloading",
  "check",
  "receipt",
  "qc",
  "putaway",
  "hold",
  "moving",
  "stocked",
  "quarantine",
] as const;
export type HuPhase = (typeof HU_PHASES)[number];

export const HU_PHASE_LABELS: Record<HuPhase, string> = {
  truck: "On the truck",
  unloading: "Coming off",
  check: "Waiting for the dock check",
  receipt: "Waiting for its receipt",
  qc: "In QC",
  putaway: "Ready to put away",
  hold: "Red-tagged for MRB",
  moving: "Going to its zone",
  stocked: "In stock",
  quarantine: "In MRB",
};

/** The phases an HU spends on the receiving floor, in the order the legend shows them. */
export const FLOOR_PHASES: readonly HuPhase[] = ["check", "receipt", "qc", "putaway", "hold"];

export function huPhase(hu: HuTrace, t: number): HuPhase {
  if (t < hu.unloadStart) return "truck";
  if (t < hu.unloaded) return "unloading";
  if (t < hu.checked) return "check";
  if (t >= hu.putStart) return t < hu.stored ? "moving" : hu.outcome === STOCKED ? "stocked" : "quarantine";
  const tagged = hu.outcome === DAMAGED ? hu.checked : hu.outcome === REJECTED ? hu.qcEnd : Infinity;
  if (t >= tagged) return "hold";
  if (t < hu.received) return "receipt";
  if (hu.inspect && t < hu.qcEnd) return "qc";
  return "putaway";
}

/** Hours of [a, b] inside the dock's open hours. */
export function openWithin(cfg: InboundConfig, a: number, b: number): number {
  let sum = 0;
  for (let day = Math.floor(a / 24); day * 24 < b; day++) {
    sum += Math.max(0, Math.min(b, day * 24 + cfg.closes) - Math.max(a, day * 24 + cfg.opens));
  }
  return sum;
}

/** Hours a truck has sat at the dock past its free time, by `t`. */
export function detentionOf(tr: TruckTrace, cfg: InboundConfig, t: number): number {
  if (t < tr.arrive) return 0;
  const from = Math.max(tr.arrive, tr.appointment);
  return Math.max(0, Math.min(t, tr.departed) - from - cfg.freeHours);
}

export interface InboundStats {
  t: number;
  trucks: Record<TruckPhase, number>;
  /** Trucks out, and the mean hours from arriving at the gate to pulling off the door. */
  departed: number;
  turnHours: number | null;
  /** Share of trucks arrived so far that turned up no more than half an hour late. */
  onTime: number | null;
  detentionHours: number;
  /** Mean hours from an HU coming off the truck to its units being in stock. */
  dockToStock: number | null;
  hus: Record<HuPhase, number>;
  /** HUs on the floor in dock staging and the bay's laydown. */
  staged: [number, number];
  stockedUnits: number;
  damaged: number;
  rejected: number;
  expedites: number;
  /** Per door, the truck on it (an index into `trucks`) or -1. */
  doors: number[];
  /** Busy share of each resource over the dock's open hours in the last seven days (the guard's, over all hours). */
  utilization: Record<Resource | "doors", number>;
  /** Crew-hours worked outside dock hours. */
  overtimeHours: number;
}

const zeros = <K extends string>(keys: readonly K[]) =>
  Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;

export function inboundStatsAt(trace: InboundTrace, t: number): InboundStats {
  const cfg = trace.config;
  const since = Math.max(0, t - 168);
  const trucks = zeros(TRUCK_PHASES);
  const doors: number[] = new Array(cfg.vanDoors + cfg.flatbedBays).fill(-1);
  let departed = 0;
  let turn = 0;
  let arrived = 0;
  let onTime = 0;
  let detention = 0;
  let doorHours = 0;
  let expedites = 0;
  trace.trucks.forEach((tr, i) => {
    if (tr.expedite && tr.ordered <= t) expedites++;
    const phase = truckPhase(tr, t);
    trucks[phase]++;
    if (phase === "enroute") return;
    arrived++;
    if (tr.arrive <= tr.appointment + 0.5) onTime++;
    detention += detentionOf(tr, cfg, t);
    if (phase === "gone") {
      departed++;
      turn += tr.departed - tr.arrive;
    }
    if (tr.docked <= t) {
      doorHours += Math.max(0, Math.min(t, tr.departed) - Math.max(since, tr.docked));
      if (phase !== "gone") doors[tr.door] = i;
    }
  });

  const hus = zeros(HU_PHASES);
  const staged: [number, number] = [0, 0];
  let stockedUnits = 0;
  let dockToStock = 0;
  let stocked = 0;
  let damaged = 0;
  let rejected = 0;
  for (const hu of trace.hus) {
    const phase = huPhase(hu, t);
    hus[phase]++;
    if (phase !== "truck" && phase !== "moving" && phase !== "stocked" && phase !== "quarantine") staged[hu.area]++;
    if (phase === "stocked") {
      stocked++;
      stockedUnits += hu.units;
      dockToStock += hu.stored - hu.unloaded;
    }
    if (hu.outcome === DAMAGED && hu.checked <= t) damaged++;
    if (hu.outcome === REJECTED && hu.qcEnd <= t) rejected++;
  }

  const open = openWithin(cfg, since, t);
  const capacity: Record<Resource, number> = {
    guard: 1,
    handlers: cfg.handlers,
    forklifts: cfg.forklifts,
    cranes: cfg.flatbedBays,
    clerks: cfg.clerks,
    inspectors: cfg.inspectors,
  };
  const utilization = zeros([...RESOURCES, "doors"] as const);
  let overtime = 0;
  for (const r of RESOURCES) {
    let busy = 0;
    for (const h of trace.holds[r]) {
      if (h.t0 >= t) continue;
      const end = Math.min(h.t1, t);
      busy += Math.max(0, end - Math.max(since, h.t0)) * h.n;
      if (r === "handlers" || r === "clerks") overtime += (end - h.t0 - openWithin(cfg, h.t0, end)) * h.n;
    }
    const span = r === "guard" ? t - since : open;
    utilization[r] = span > 0 ? Math.min(1, busy / (capacity[r] * span)) : 0;
  }
  utilization.doors = open > 0 ? Math.min(1, doorHours / (doors.length * open)) : 0;

  return {
    t,
    trucks,
    departed,
    turnHours: departed ? turn / departed : null,
    onTime: arrived ? onTime / arrived : null,
    detentionHours: detention,
    dockToStock: stocked ? dockToStock / stocked : null,
    hus,
    staged,
    stockedUnits,
    damaged,
    rejected,
    expedites,
    doors,
    utilization,
    overtimeHours: Math.max(0, overtime),
  };
}

export const truckName = (tr: TruckTrace): string => `T-${String(tr.id).padStart(4, "0")}`;
export const huName = (hu: HuTrace): string => `HU-${String(hu.id).padStart(5, "0")}`;
