import { HANDLING, type InboundConfig, type StoreZone, type TruckKind } from "../model/inbound";
import { HU_PHASES, huPhase, truckPhase } from "../sim/inboundStats";
import { STOCKED, type HuTrace, type InboundTrace, type TruckTrace } from "../sim/inbound";

/*
 * The receiving dock's plan, in metres: x east, y south, the dock wall at
 * x = WALL with the yard and gate outside it and the receiving floor inside.
 * Where each truck and HU is drawn at a moment is worked out here, from the
 * trace alone, so the plan view only has to draw it.
 */

export const WALL = 60;
const CAB = 6;
export const TRAILER: Record<TruckKind, number> = { van: 16.2, flatbed: 14.6 };
export const TRUCK_WIDTH = 2.6;
const DOOR_PITCH = 5;
const STAGE_COLS = 8;
const STAGE_PITCH = 4.25;
const STAGE_ROW = 4;
export const STAGE_SIZE = 3;
const LAY_COLS = 4;
const LAY_PITCH_X = 8.5;
const LAY_PITCH_Y = 4.5;
export const LAY_SIZE: [number, number] = [7.4, 3.4];
const BAY_HEIGHT = 10;
const STALL_PITCH = 4.6;
const STALLS_PER_ROW = 12;
const RIG = (kind: TruckKind) => CAB + TRAILER[kind];
/** Hours a truck takes to drive between two places on the plan. */
const DRIVE = 0.08;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlanLayout {
  width: number;
  height: number;
  building: Rect;
  doors: { kind: TruckKind; name: string; y: number }[];
  stage: Rect;
  staging: { x: number; y: number }[];
  bays: Rect[];
  laydown: { x: number; y: number }[];
  laydownArea: Rect;
  qc: Rect;
  mrb: Rect;
  zones: Record<StoreZone, Rect>;
  stalls: { x: number; y: number }[];
  yardTop: number;
  roadY: number;
  gateX: number;
}

export function planLayout(cfg: InboundConfig): PlanLayout {
  const doors: PlanLayout["doors"] = [];
  for (let i = 0; i < cfg.vanDoors; i++) doors.push({ kind: "van", name: `D${i + 1}`, y: 6 + i * DOOR_PITCH });
  const dockEnd = 6 + (cfg.vanDoors - 1) * DOOR_PITCH + 4;

  const stageRows = Math.max(1, Math.ceil(cfg.dockStaging / STAGE_COLS));
  const staging = Array.from({ length: cfg.dockStaging }, (_, i) => ({
    x: WALL + 5 + (i % STAGE_COLS) * STAGE_PITCH,
    y: 4 + Math.floor(i / STAGE_COLS) * STAGE_ROW,
  }));
  const stage = {
    x: WALL + 3,
    y: 2,
    w: STAGE_COLS * STAGE_PITCH + 1.5,
    h: stageRows * STAGE_ROW + 1,
  };

  const bayTop = Math.max(dockEnd, stage.y + stage.h) + 3;
  const bays: Rect[] = [];
  for (let b = 0; b < cfg.flatbedBays; b++) {
    const y = bayTop + b * (BAY_HEIGHT + 1);
    bays.push({ x: WALL, y, w: 23, h: BAY_HEIGHT });
    doors.push({ kind: "flatbed", name: `B${b + 1}`, y: y + BAY_HEIGHT / 2 });
  }
  const layRows = Math.max(1, Math.ceil(cfg.bayLaydown / LAY_COLS));
  const laydown = Array.from({ length: cfg.bayLaydown }, (_, i) => ({
    x: WALL + 26 + (i % LAY_COLS) * LAY_PITCH_X,
    y: bayTop + 0.5 + Math.floor(i / LAY_COLS) * LAY_PITCH_Y,
  }));
  const laydownArea = {
    x: WALL + 25,
    y: bayTop,
    w: LAY_COLS * LAY_PITCH_X + 0.5,
    h: layRows * LAY_PITCH_Y + 0.5,
  };
  const baysEnd = bayTop + cfg.flatbedBays * (BAY_HEIGHT + 1);

  const right = WALL + 64;
  const qc = {
    x: stage.x + stage.w + 2,
    y: 2,
    w: right - stage.x - stage.w - 4,
    h: 8,
  };
  const mrb = {
    x: qc.x,
    y: qc.y + qc.h + 2,
    w: qc.w,
    h: Math.max(7, stage.y + stage.h - qc.y - qc.h - 2),
  };
  const zoneX = right + 1;
  const zoneW = 16;
  const buildingBottom = Math.max(baysEnd, laydownArea.y + laydownArea.h, mrb.y + mrb.h) + 2;
  const zones: Record<StoreZone, Rect> = {
    cage: { x: zoneX, y: 2, w: zoneW, h: 10 },
    racking: { x: zoneX, y: 14, w: zoneW, h: Math.max(8, bayTop - 16) },
    steel: {
      x: zoneX,
      y: bayTop,
      w: zoneW,
      h: Math.max(8, buildingBottom - bayTop - 2),
    },
  };
  const width = zoneX + zoneW + 2;

  const yardTop = buildingBottom + 5;
  const stallRows = Math.max(1, Math.ceil(cfg.yardStalls / STALLS_PER_ROW));
  const stalls = Array.from({ length: cfg.yardStalls }, (_, i) => ({
    x: 4 + (i % STALLS_PER_ROW) * STALL_PITCH,
    y: yardTop + Math.floor(i / STALLS_PER_ROW) * 25,
  }));
  const roadY = yardTop + stallRows * 25 + 2;

  return {
    width,
    height: roadY + 5,
    building: { x: WALL, y: 0, w: width - WALL, h: buildingBottom },
    doors,
    stage,
    staging,
    bays,
    laydown,
    laydownArea,
    qc,
    mrb,
    zones,
    stalls,
    yardTop,
    roadY,
    gateX: 52,
  };
}

/** Where a rig is: its front at (x, y), heading in degrees (0 is east), its body trailing behind. */
export interface Pose {
  x: number;
  y: number;
  heading: number;
}

export interface DrawnTruck {
  index: number;
  pose: Pose;
  kind: TruckKind;
  /** HUs still on board, for a flatbed's deck. */
  aboard: number;
  phase: ReturnType<typeof truckPhase>;
  /** Waiting at the dock past its free time. */
  detained: boolean;
}

export interface DrawnHu {
  index: number;
  x: number;
  y: number;
  /** 0 on the floor, 1 on the bay's laydown: which footprint to draw. */
  area: number;
  phase: (typeof HU_PHASES)[number];
}

const ease = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
function blend(a: Pose, b: Pose, u: number): Pose {
  const k = ease(u);
  let d = b.heading - a.heading;
  d = ((((d + 180) % 360) + 360) % 360) - 180;
  return {
    x: lerp(a.x, b.x, k),
    y: lerp(a.y, b.y, k),
    heading: a.heading + d * k,
  };
}

export function doorPose(plan: PlanLayout, door: number, kind: TruckKind): Pose {
  const d = plan.doors[door];
  return kind === "van" ? { x: WALL - RIG(kind), y: d.y, heading: 180 } : { x: WALL + 22, y: d.y, heading: 0 };
}

const stallPose = (plan: PlanLayout, stall: number): Pose => ({
  x: plan.stalls[stall].x + TRUCK_WIDTH / 2,
  y: plan.stalls[stall].y,
  heading: -90,
});

const gatePose = (plan: PlanLayout, rank: number): Pose => ({
  x: plan.gateX - rank * 24,
  y: plan.roadY,
  heading: 0,
});
const exitPose = (plan: PlanLayout): Pose => ({
  x: -30,
  y: plan.roadY,
  heading: 180,
});

/** Every truck on the plan at `t`, posed. Trucks at the gate queue along the road in arrival order. */
export function drawTrucks(trace: InboundTrace, plan: PlanLayout, t: number): DrawnTruck[] {
  const cfg = trace.config;
  const out: DrawnTruck[] = [];
  const queue: number[] = [];
  trace.trucks.forEach((tr, i) => {
    if (tr.arrive <= t && t < Math.min(tr.stallAt, tr.docked)) queue.push(i);
  });
  queue.sort((a, b) => trace.trucks[a].arrive - trace.trucks[b].arrive);
  const rank = new Map(queue.map((i, k) => [i, k]));

  trace.trucks.forEach((tr, index) => {
    if (t < tr.arrive || t >= tr.departed + DRIVE) return;
    const phase = truckPhase(tr, t);
    const waiting = rank.get(index);
    const before = tr.stall >= 0 ? stallPose(plan, tr.stall) : gatePose(plan, 0);
    let pose: Pose;
    if (waiting !== undefined) pose = gatePose(plan, waiting);
    else if (t < tr.docked) pose = blend(gatePose(plan, 0), stallPose(plan, tr.stall), (t - tr.stallAt) / DRIVE);
    else if (t < tr.departed) {
      const span = Math.max(0.02, Math.min(DRIVE * 1.5, tr.ready - tr.docked));
      pose = blend(before, doorPose(plan, tr.door, tr.kind), (t - tr.docked) / span);
    } else pose = blend(doorPose(plan, tr.door, tr.kind), exitPose(plan), (t - tr.departed) / DRIVE);
    const aboard = tr.hus.reduce((n, h) => n + (t < trace.hus[h].unloadStart ? 1 : 0), 0);
    const detained = phase !== "gone" && t - Math.max(tr.arrive, tr.appointment) > cfg.freeHours;
    out.push({ index, pose, kind: tr.kind, aboard, phase, detained });
  });
  return out;
}

function slotPoint(plan: PlanLayout, hu: HuTrace): { x: number; y: number } {
  if (hu.area === 0) {
    const s = plan.staging[hu.slot];
    return { x: s.x + STAGE_SIZE / 2, y: s.y + STAGE_SIZE / 2 };
  }
  const s = plan.laydown[hu.slot];
  return { x: s.x + LAY_SIZE[0] / 2, y: s.y + LAY_SIZE[1] / 2 };
}

function zonePoint(plan: PlanLayout, hu: HuTrace): { x: number; y: number } {
  const r = hu.outcome === STOCKED ? plan.zones[HANDLING[hu.handling].zone] : plan.mrb;
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

function truckPoint(plan: PlanLayout, tr: TruckTrace): { x: number; y: number } {
  const y = plan.doors[tr.door].y;
  return tr.kind === "van" ? { x: WALL - 1, y } : { x: WALL + 12, y };
}

/** Every HU on the receiving floor at `t`, or on its way off a truck or to its zone. */
export function drawHus(trace: InboundTrace, plan: PlanLayout, t: number): DrawnHu[] {
  const out: DrawnHu[] = [];
  trace.hus.forEach((hu, index) => {
    if (t < hu.unloadStart || t >= hu.stored) return;
    const phase = huPhase(hu, t);
    const at = slotPoint(plan, hu);
    let p = at;
    if (t < hu.unloaded) {
      const from = truckPoint(plan, trace.trucks[hu.truck]);
      const u = ease((t - hu.unloadStart) / (hu.unloaded - hu.unloadStart));
      p = { x: lerp(from.x, at.x, u), y: lerp(from.y, at.y, u) };
    } else if (t >= hu.putStart) {
      const to = zonePoint(plan, hu);
      const u = ease((t - hu.putStart) / (hu.stored - hu.putStart));
      p = { x: lerp(at.x, to.x, u), y: lerp(at.y, to.y, u) };
    }
    out.push({ index, x: p.x, y: p.y, area: hu.area, phase });
  });
  return out;
}

/** Where each bay's crane trolley is: over the HU it's lifting, or parked. */
export function cranePositions(trace: InboundTrace, plan: PlanLayout, hus: readonly DrawnHu[], t: number): number[] {
  const parked = plan.laydownArea.x + plan.laydownArea.w / 2;
  const xs = plan.bays.map(() => parked);
  let bay = 0;
  for (const hold of trace.holds.cranes) {
    if (hold.t0 > t || t >= hold.t1 || hold.hu < 0) continue;
    const drawn = hus.find((h) => h.index === hold.hu);
    if (drawn && bay < xs.length) xs[bay++] = drawn.x;
  }
  return xs;
}

export const rigLength = RIG;
