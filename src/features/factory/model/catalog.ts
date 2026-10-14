import { PODS, type BuildStep, type PodSpec } from "../../home/assembly/podSpec";
import { DEFAULT_INBOUND, type InboundConfig } from "./inbound";

/*
 * The compute pod production line: its stations, the materials they draw from
 * the parts store, and the default scenario the simulation runs. Stations map
 * one to one onto the compute pod's build steps in podSpec, so every part the
 * line installs is a part of the real pod. Times are in hours.
 *
 * The work content and crews below are placeholders, not measured figures;
 * replace them as the real factory's numbers come in. Suppliers, lead times
 * and receiving live in inbound.ts.
 */

export const COMPUTE_POD: PodSpec = PODS.find((pod) => pod.id === "compute")!;

/** Min, typical and max of a triangular distribution. */
export type Spread = [min: number, mode: number, max: number];

export interface Material {
  id: string;
  label: string;
  /** Part ids in podSpec that are one unit of this material, by prefix. */
  prefixes: string[];
}

export const MATERIALS: readonly Material[] = [
  { id: "base", label: "Base frames", prefixes: ["base"] },
  { id: "post", label: "Steel posts", prefixes: ["post-"] },
  { id: "rail", label: "Top rails", prefixes: ["rail-"] },
  { id: "rack-compute", label: "Compute racks", prefixes: ["rack-C"] },
  { id: "rack-network", label: "Network racks", prefixes: ["rack-NS"] },
  { id: "busway", label: "Busway runs", prefixes: ["bus-"] },
  { id: "header", label: "Cooling headers", prefixes: ["w-", "c-"] },
  { id: "tray", label: "Fiber trays", prefixes: ["tray-"] },
  { id: "panel", label: "Wall and end panels", prefixes: ["end-", "rear-", "front-"] },
  { id: "roof", label: "Service roofs", prefixes: ["service-roof"] },
];

/** Index into MATERIALS of the material a pod part is made from, or -1. */
export function materialOf(partId: string): number {
  return MATERIALS.findIndex((m) => m.prefixes.some((p) => partId.startsWith(p)));
}

export interface StationConfig {
  /** The podSpec build step this station performs, or "test" for commissioning. */
  step: string;
  code: string;
  label: string;
  crew: number;
  /** Person-hours of work per pod, shared across the crew. */
  work: Spread;
  /** Hours of the cycle the overhead crane is held, from the start. */
  craneHours: number;
  /** Pod slots in the buffer lane after this station. */
  bufferAfter: number;
  /** Chance a pod fails here and is reworked in place, and the rework's person-hours. */
  rework?: { chance: number; work: Spread };
}

export interface Scenario {
  stations: StationConfig[];
  /** A new pod order is released every this many hours. */
  releaseEveryHours: number;
  horizonDays: number;
  seed: number;
  /** Hours to move a pod one position along the line. */
  moveHours: number;
  /** Hours to pick a station's kit and cart it from the store. */
  kitHours: number;
  /** The store reorders every this many hours. */
  reviewHours: number;
  /** Each material is reordered up to this many pods' worth. */
  coverPods: number;
  /** The receiving dock every order comes in through. */
  inbound: InboundConfig;
}

export const DEFAULT_SCENARIO: Scenario = {
  stations: [
    { step: "base", code: "S1", label: "Base frame + deck", crew: 4, work: [20, 24, 32], craneHours: 1, bufferAfter: 1 },
    { step: "frame", code: "S2", label: "Steel frame", crew: 4, work: [26, 32, 40], craneHours: 0, bufferAfter: 1 },
    { step: "racks", code: "S3", label: "Rack install", crew: 6, work: [48, 60, 78], craneHours: 0, bufferAfter: 1 },
    { step: "busways", code: "S4", label: "Busways", crew: 3, work: [20, 24, 30], craneHours: 0, bufferAfter: 1 },
    { step: "headers", code: "S5", label: "Cooling headers", crew: 4, work: [40, 46, 60], craneHours: 0, bufferAfter: 1 },
    { step: "fiber", code: "S6", label: "Fiber trays", crew: 3, work: [14, 18, 24], craneHours: 0, bufferAfter: 1 },
    { step: "walls", code: "S7", label: "Service panels", crew: 4, work: [26, 32, 40], craneHours: 0, bufferAfter: 1 },
    { step: "roof", code: "S8", label: "Service roof", crew: 4, work: [18, 24, 30], craneHours: 2, bufferAfter: 1 },
    {
      step: "test",
      code: "S9",
      label: "Test + commission",
      crew: 3,
      work: [24, 30, 36],
      craneHours: 0,
      bufferAfter: 0,
      rework: { chance: 0.1, work: [12, 18, 30] },
    },
  ],
  releaseEveryHours: 13,
  horizonDays: 60,
  seed: 1,
  moveHours: 0.5,
  kitHours: 1.5,
  reviewHours: 168,
  coverPods: 56,
  inbound: DEFAULT_INBOUND,
};

/** The podSpec build step a station performs; commissioning has none. */
export function stepOf(station: StationConfig): BuildStep | null {
  return COMPUTE_POD.steps.find((s) => s.id === station.step) ?? null;
}

/** Units of each material (by MATERIALS index) one station uses per pod. */
export function kitOf(station: StationConfig): number[] {
  const kit = MATERIALS.map(() => 0);
  for (const part of stepOf(station)?.parts ?? []) {
    const m = materialOf(part.id);
    if (m >= 0) kit[m]++;
  }
  return kit;
}

/** Units of each material in one pod. */
export function podBill(stations: readonly StationConfig[]): number[] {
  const bill = MATERIALS.map(() => 0);
  for (const s of stations) kitOf(s).forEach((n, m) => (bill[m] += n));
  return bill;
}

const mean = ([a, b, c]: Spread) => (a + b + c) / 3;

/** Expected hours a station holds a pod for, rework included. */
export function meanCycleHours(station: StationConfig): number {
  const rework = station.rework ? station.rework.chance * mean(station.rework.work) : 0;
  return (mean(station.work) + rework) / station.crew;
}

/** The slowest station on average, which caps the line's output. */
export function bottleneckOf(stations: readonly StationConfig[]): { index: number; hours: number } {
  let index = 0;
  for (let i = 1; i < stations.length; i++) {
    if (meanCycleHours(stations[i]) > meanCycleHours(stations[index])) index = i;
  }
  return { index, hours: meanCycleHours(stations[index]) };
}

/** One place a pod can be on the line: a station's bay or a slot in the buffer lane after it. */
export type FlowPos = { kind: "station"; station: number } | { kind: "buffer"; station: number; slot: number };

/** Every position along the line in flow order. */
export function flowOf(stations: readonly StationConfig[]): FlowPos[] {
  const flow: FlowPos[] = [];
  stations.forEach((s, i) => {
    flow.push({ kind: "station", station: i });
    if (i < stations.length - 1) {
      for (let k = 0; k < s.bufferAfter; k++) flow.push({ kind: "buffer", station: i, slot: k });
    }
  });
  return flow;
}
