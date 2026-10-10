/*
 * Build data for the three ZODE pods, curated from the NIRA Chassis I design
 * set (../zode/data: pods.json, racks.json, parts.json, bom.json). Everything
 * is in millimetres in a pod-local frame:
 *   x: along the pod length, 0 at the left end
 *   y: up, 0 at the underside of the base frame
 *   z: across the pod, 0 at the front face (the side facing the viewer)
 * Every shape is an axis-aligned box given by its min corner + size, so a
 * cylinder is described by its bounding box and `axis`.
 */

export const POD = {
  length: 6058,
  width: 2438,
  height: 3400,
  floor: 200,
  frame: 150,
  joint: 57,
} as const;

const L = POD.length;
const W = POD.width;
const F = POD.floor;
const M = POD.frame;
const TOP = POD.height - M; // underside of the top rails
const POST_H = TOP - F;

/** Vertical solid from a plan outline (pod-local mm) with per-edge rounding of its top / bottom edges. */
export interface LoftData {
  plan: [number, number][];
  top?: number;
  /** Weight per plan edge (edge i runs from point i to i + 1); 0 keeps it square. */
  topW?: number[];
  bottom?: number;
  bottomW?: number[];
}

export interface Shape {
  kind: "box" | "cyl" | "loft";
  loft?: LoftData;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  /** Cylinder axis; defaults to "y". */
  axis?: "x" | "y" | "z";
  /** Rotation about the pod's long axis through the box centre (radians); positive tips the top toward the front. */
  tilt?: number;
  /** Draw with the thin detail line weight. */
  detail?: boolean;
  /** Lines only: no background fill, so it never hides what is behind it. */
  ghost?: boolean;
  /** Box: fillet radius on the edges parallel to `roundAxis`. */
  round?: number;
  /** Box: chamfer on the edges parallel to `roundAxis` (wins over `round`). */
  bevel?: number;
  /** Box: radius on only the two upper edges along `roundAxis` ("x" or "z"). */
  roundTop?: number;
  /** Box: chamfer on only the two upper edges along `roundAxis` ("x" or "z"). */
  bevelTop?: number;
  /** Box: which edges `round` / `bevel` / `roundTop` soften; defaults to the longest dimension. */
  roundAxis?: "x" | "y" | "z";
  /** Soft rounded edge around both end caps (box ends along `roundAxis`, or cylinder ends). */
  cap?: number;
}

type Soft = Partial<Pick<Shape, "detail" | "round" | "bevel" | "roundTop" | "bevelTop" | "roundAxis" | "cap">>;

/**
 * How a part arrives:
 * - belt:   rides in on the conveyor with the pod
 * - place:  a robot arm carries it from its feeder pad
 * - lower:  the gantry crane lifts it off the staging pad and lowers it in
 * - grow-*: welded / extruded in place along an axis by a robot arm
 */
export type Motion = "belt" | "place" | "lower" | "grow-x" | "grow-y" | "grow-z";
export type Tool = "belt" | "arm" | "gantry";

export interface Part {
  id: string;
  shapes: Shape[];
  motion?: Motion;
}

export interface BuildStep {
  id: string;
  label: string;
  tool: Tool;
  seconds: number;
  parts: Part[];
}

export interface PodSpec {
  id: "electrical" | "cooling" | "compute";
  title: string;
  summary: string;
  steps: BuildStep[];
}

const box = (
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  opts: Soft & Partial<Pick<Shape, "tilt" | "ghost">> = {},
): Shape => ({ kind: "box", x, y, z, w, h, d, ...opts });

const soft = (opts: Soft | boolean): Soft => (typeof opts === "boolean" ? { detail: opts } : opts);

/** Vertical cylinder from its plan centre, base height, diameter and height. */
const cylY = (cx: number, y: number, cz: number, dia: number, h: number, opts: Soft | boolean = {}): Shape => ({
  kind: "cyl",
  axis: "y",
  x: cx - dia / 2,
  y,
  z: cz - dia / 2,
  w: dia,
  h,
  d: dia,
  ...soft(opts),
});

/** Cylinder running along the pod length from x0 to x1. */
const cylX = (x0: number, x1: number, cy: number, cz: number, od: number, opts: Soft = {}): Shape => ({
  kind: "cyl",
  axis: "x",
  x: x0,
  y: cy - od / 2,
  z: cz - od / 2,
  w: x1 - x0,
  h: od,
  d: od,
  ...opts,
});

/** Cylinder running across the pod from z0 to z1. */
const cylZ = (cx: number, cy: number, z0: number, z1: number, od: number, opts: Soft = {}): Shape => ({
  kind: "cyl",
  axis: "z",
  x: cx - od / 2,
  y: cy - od / 2,
  z: z0,
  w: od,
  h: od,
  d: z1 - z0,
  ...opts,
});

/** Union bounding box of a part's shapes (tilt ignored). */
export function partBounds(part: Part): { x: number; y: number; z: number; w: number; h: number; d: number } {
  let x0 = Infinity,
    y0 = Infinity,
    z0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity,
    z1 = -Infinity;
  for (const s of part.shapes) {
    x0 = Math.min(x0, s.x);
    y0 = Math.min(y0, s.y);
    z0 = Math.min(z0, s.z);
    x1 = Math.max(x1, s.x + s.w);
    y1 = Math.max(y1, s.y + s.h);
    z1 = Math.max(z1, s.z + s.d);
  }
  return { x: x0, y: y0, z: z0, w: x1 - x0, h: y1 - y0, d: z1 - z0 };
}

// ---------------------------------------------------------------------------
// Steps shared by all three pods
// ---------------------------------------------------------------------------

function baseStep(): BuildStep {
  return {
    id: "base",
    label: "Base frame + floor deck",
    tool: "belt",
    seconds: 2.6,
    parts: [
      {
        id: "base",
        shapes: [
          box(0, 0, 0, L, F - 40, M),
          box(0, 0, W - M, L, F - 40, M),
          box(0, 0, M, M, F - 40, W - 2 * M),
          box(L - M, 0, M, M, F - 40, W - 2 * M),
          box(0, F - 40, 0, L, 40, W),
          ...[1, 2, 3, 4].map((i) => box((L / 5) * i - 20, F, 120, 40, 2, W - 240, { detail: true, ghost: true })),
        ],
      },
    ],
  };
}

/** Free-standing cabinet: rounded vertical edges, softened top and bottom. */
const CABINET: Soft = { round: 40, roundAxis: "y", cap: 20 };
/** Door / panel plate on a front face, rounded in elevation. */
const PLATE: Soft = { detail: true, round: 30, roundAxis: "z" };
/** Pipe run with softened ends. */
const PIPE: Soft = { cap: 30 };

function frameStep(): BuildStep {
  const mid = L / 2 - M / 2;
  return {
    id: "frame",
    label: "Steel frame: posts + top rails",
    tool: "arm",
    seconds: 4.6,
    parts: [
      { id: "post-fl", motion: "grow-y", shapes: [box(0, F, 0, M, POST_H, M)] },
      { id: "post-rr", motion: "grow-y", shapes: [box(L - M, F, W - M, M, POST_H, M)] },
      { id: "post-fm", motion: "grow-y", shapes: [box(mid, F, 0, M, POST_H, M)] },
      { id: "post-rm", motion: "grow-y", shapes: [box(mid, F, W - M, M, POST_H, M)] },
      { id: "post-fr", motion: "grow-y", shapes: [box(L - M, F, 0, M, POST_H, M)] },
      { id: "post-rl", motion: "grow-y", shapes: [box(0, F, W - M, M, POST_H, M)] },
      { id: "rail-f", motion: "grow-x", shapes: [box(0, TOP, 0, L, M, M)] },
      { id: "rail-r", motion: "grow-x", shapes: [box(0, TOP, W - M, L, M, M)] },
      { id: "rail-l", motion: "grow-z", shapes: [box(0, TOP, M, M, M, W - 2 * M)] },
      { id: "rail-e", motion: "grow-z", shapes: [box(L - M, TOP, M, M, M, W - 2 * M)] },
    ],
  };
}

/** Outer cladding thickness; two pods' end skins still fit inside the coupling joint. */
const CLAD = 25;

/** Rounded bumper on the row's two outer ends (electrical right, compute left): plan corner radius and depth. */
export const END_CAP = 450;
/** Radius of the outer ends' rounded bottom edge, seen from the front. */
const END_FOOT = 300;

type End = "left" | "right";
type Side = "front" | "back" | End;

/** One plan edge: which side it belongs to and, on a corner arc, how far round (0 at the long side, 1 at the end). */
interface PlanEdge {
  side: Side;
  arc: boolean;
  t: number;
}

interface Plan {
  pts: [number, number][];
  edges: PlanEdge[];
}

/** Plan outline of x0..x1 by z0..z1 (pod-local mm) whose `rounded` ends get corner radius r. */
function planOutline(x0: number, x1: number, z0: number, z1: number, r: number, rounded: readonly End[]): Plan {
  const pts: [number, number][] = [];
  const edges: PlanEdge[] = [];
  const add = (x: number, z: number, e: PlanEdge) => {
    const last = pts[pts.length - 1];
    if (last && Math.abs(last[0] - x) < 1e-6 && Math.abs(last[1] - z) < 1e-6) {
      edges[edges.length - 1] = e;
      return;
    }
    pts.push([x, z]);
    edges.push(e);
  };
  const straight = (side: Side): PlanEdge => ({ side, arc: false, t: 0 });
  const SEG = 8;
  const arc = (cx: number, cz: number, a0: number, side: End, towardEnd: boolean) => {
    for (let k = 0; k < SEG; k++) {
      const a = a0 + (k / SEG) * (Math.PI / 2);
      const t = (k + 0.5) / SEG;
      add(cx + r * Math.cos(a), cz + r * Math.sin(a), { side, arc: true, t: towardEnd ? t : 1 - t });
    }
  };
  const rl = rounded.includes("left") ? r : 0;
  const rr = rounded.includes("right") ? r : 0;

  add(x0 + rl, z0, straight("front"));
  if (rr) arc(x1 - rr, z0 + rr, -Math.PI / 2, "right", true);
  add(x1, z0 + rr, straight("right"));
  if (rr) arc(x1 - rr, z1 - rr, 0, "right", false);
  add(x1 - rr, z1, straight("back"));
  if (rl) arc(x0 + rl, z1 - rl, Math.PI / 2, "left", true);
  add(x0, z1 - rl, straight("left"));
  if (rl) arc(x0 + rl, z0 + rl, Math.PI, "left", false);
  return { pts, edges };
}

function loft(
  plan: Plan,
  y: number,
  h: number,
  opts: { top?: number; topW?: (e: PlanEdge) => number; bottom?: number; bottomW?: (e: PlanEdge) => number } = {},
): Shape {
  const xs = plan.pts.map((p) => p[0]);
  const zs = plan.pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const z = Math.min(...zs);
  return {
    kind: "loft",
    x,
    y,
    z,
    w: Math.max(...xs) - x,
    h,
    d: Math.max(...zs) - z,
    loft: {
      plan: plan.pts,
      top: opts.top,
      topW: opts.topW && plan.edges.map(opts.topW),
      bottom: opts.bottom,
      bottomW: opts.bottomW && plan.edges.map(opts.bottomW),
    },
  };
}

/**
 * Roof footprint, flush with the cladding. On an outer end it runs over the
 * bumper with the same rounded corners; its top curves along the front, back
 * and any outer end, and stays square where it meets the next pod.
 */
function roofLoft(y: number, h: number, curve: number, outer?: End): Shape {
  const x0 = outer === "left" ? -END_CAP : -CLAD;
  const x1 = outer === "right" ? L + END_CAP : L + CLAD;
  const plan = planOutline(x0, x1, -CLAD, W + CLAD, END_CAP, outer ? [outer] : []);
  const curved = (e: PlanEdge) => (e.side === "front" || e.side === "back" || e.side === outer ? 1 : 0);
  return loft(plan, y, h, { top: curve, topW: curved });
}

/**
 * Cladding skin hung outside the steel frame, base to roof line, so posts,
 * rails and base members disappear behind a smooth finish. Front and rear are
 * two full-length halves meeting at `seam` (kept clear of any front detail);
 * square end panels wrap the corners, except on the row's `outer` end, which
 * gets a phone-like rounded bumper: rounded corners in plan and a rounded
 * foot that fades out where it meets the front and rear skins. Ordered so the
 * front panels close last and alternate between the front (even) and rear
 * (odd) robot arms. Front detail plates sit on the skin.
 */
function wallsStep(label: string, frontDetail: Shape[] = [], seam = L / 2, outer?: End): BuildStep {
  const H = POD.height;
  const onSkin = frontDetail.map((s) => ({ ...s, z: s.z - CLAD }));
  const end = (side: End): Shape => {
    if (side !== outer) return box(side === "left" ? -CLAD : L, 0, -CLAD, CLAD, H, W + 2 * CLAD);
    const [x0, x1] = side === "left" ? [-END_CAP, 0] : [L, L + END_CAP];
    const plan = planOutline(x0, x1, -CLAD, W + CLAD, END_CAP, [side]);
    const foot = (e: PlanEdge) => (e.side !== side ? 0 : e.arc ? Math.sin((e.t * Math.PI) / 2) : 1);
    return loft(plan, 0, H, { bottom: END_FOOT, bottomW: foot });
  };
  return {
    id: "walls",
    label,
    tool: "arm",
    seconds: 4.2,
    parts: [
      { id: "end-l", shapes: [end("left")] },
      { id: "rear-b", shapes: [box(seam, 0, W, L - seam, H, CLAD)] },
      { id: "front-a", shapes: [box(0, 0, -CLAD, seam, H, CLAD), ...onSkin.filter((s) => s.x < seam)] },
      { id: "rear-a", shapes: [box(0, 0, W, seam, H, CLAD)] },
      { id: "front-b", shapes: [box(seam, 0, -CLAD, L - seam, H, CLAD), ...onSkin.filter((s) => s.x >= seam)] },
      { id: "end-r", shapes: [end("right")] },
    ],
  };
}

/** Radius of the dry-cooler housing's curved top edges. */
const COOLER_CURVE = 300;

/**
 * Dry-cooler roof module: a coil housing with curved top edges along the
 * front and back (and round any outer end), an intake grille, and 12 EC fans
 * (2 x 6) on the flat top.
 */
function dryCoolerRoofStep(outer?: End): BuildStep {
  const y0 = POD.height;
  const top = 1480;
  const frame = 970;
  const fans: Shape[] = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 6; c++) {
      const fx = 69 + c * (frame + 20);
      const fz = 209 + r * (frame + 80);
      fans.push(
        box(fx, y0 + top, fz, frame, 20, frame, { detail: true, round: 90, roundAxis: "y" }),
        cylY(fx + frame / 2, y0 + top + 20, fz + frame / 2, 857, 80, { cap: 24 }),
        cylY(fx + frame / 2, y0 + top + 110, fz + frame / 2, 800, 10, true),
      );
    }
  }
  const louvres = [0, 1, 2, 3, 4].map((k) =>
    box(460, y0 + 360 + k * 140, -CLAD - 4, L - 920, 1, 4, { detail: true, ghost: true }),
  );

  return {
    id: "roof",
    label: "Dry-cooler roof: coil housing + 12 EC fans",
    tool: "gantry",
    seconds: 4.4,
    parts: [
      {
        id: "dry-cooler",
        shapes: [
          roofLoft(y0, top, COOLER_CURVE, outer),
          box(400, y0 + 240, -CLAD - 4, L - 800, 860, 4, { ...PLATE, round: 120, ghost: true }),
          ...louvres,
          ...fans,
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Electrical pod: 2 MVA transformer, 3,200 A LV board, UPS + battery
// ---------------------------------------------------------------------------

function transformer(): Shape[] {
  const x = 80;
  const z = 235;
  const w = 2350;
  const d = 1650;
  const cz = z + d / 2;
  const coils = [1, 3, 5].map((k) => cylY(x + (w / 6) * k, F + 330, cz, 640, 1520, { cap: 70 }));
  const post: Soft = { detail: true, round: 22 };
  return [
    box(x, F, z, w, 150, d, { round: 90, roundAxis: "y", cap: 25 }),
    box(x + 100, F + 150, cz - 250, w - 200, 180, 500, { round: 70 }),
    ...coils,
    box(x + 100, F + 1850, cz - 250, w - 200, 220, 500, { round: 80 }),
    box(x, F + 2070, z, w, 30, d, { detail: true, ghost: true }),
    ...[x, x + w - 60].flatMap((px) => [
      box(px, F + 150, z, 60, 1920, 60, post),
      box(px, F + 150, z + d - 60, 60, 1920, 60, post),
    ]),
  ];
}

const ELECTRICAL: PodSpec = {
  id: "electrical",
  title: "Electrical Pod",
  summary: "2 MVA transformer, 3,200 A switchboard and protected UPS power for the whole ZODE.",
  steps: [
    baseStep(),
    frameStep(),
    {
      id: "partitions",
      label: "Fire-rated partitions",
      tool: "arm",
      seconds: 2.2,
      parts: [
        { id: "part-a", motion: "grow-y", shapes: [box(2500, F, M, 100, POST_H, W - 2 * M)] },
        { id: "part-b", motion: "grow-y", shapes: [box(4550, F, M, 100, POST_H, W - 2 * M)] },
      ],
    },
    {
      id: "e1",
      label: "E1 · 2 MVA dry-type transformer",
      tool: "gantry",
      seconds: 3.8,
      parts: [{ id: "e1", shapes: transformer() }],
    },
    {
      id: "e3",
      label: "E3 · 3,200 A LV switchboard",
      tool: "arm",
      seconds: 3.6,
      parts: [0, 1, 2, 3].map((i) => ({
        id: `e3-${i}`,
        shapes: [
          box(2672 + i * 450, F, 100, 450, 2300, 850, CABINET),
          box(2672 + i * 450 + 40, F + 120, 92, 370, 2060, 8, PLATE),
        ],
      })),
    },
    {
      id: "e12",
      label: "E12 · 100 kW UPS + battery",
      tool: "arm",
      seconds: 2.8,
      parts: [
        {
          id: "ups",
          shapes: [box(4705, F, 100, 500, 2000, 900, CABINET), box(4745, F + 1500, 92, 420, 300, 8, PLATE)],
        },
        {
          id: "battery",
          shapes: [
            box(5225, F, 100, 500, 2000, 900, CABINET),
            ...[0, 1, 2, 3].map((k) => box(5265, F + 200 + k * 420, 92, 420, 300, 8, PLATE)),
          ],
        },
      ],
    },
    {
      id: "e8",
      label: "E8 · Transformer ventilation fans",
      tool: "arm",
      seconds: 2.2,
      parts: [
        { id: "fan-a", shapes: [cylZ(700, 2650, W - M - 360, W - M, 700, { cap: 45 })] },
        { id: "fan-b", shapes: [cylZ(1750, 2650, W - M - 360, W - M, 700, { cap: 45 })] },
      ],
    },
    wallsStep(
      "Wall panels + access doors",
      [
        box(500, 2300, -8, 1300, 600, 8, { ...PLATE, round: 90 }),
        box(3700, F + 100, -8, 1000, 2100, 8, { ...PLATE, round: 90 }),
      ],
      L / 2,
      "right",
    ),
    dryCoolerRoofStep("right"),
  ],
};

// ---------------------------------------------------------------------------
// Cooling pod: N+1 pump skids, heat exchanger, 2 x 3,785 L buffer tanks
// ---------------------------------------------------------------------------

function pumpSkid(x: number, pumps: [number, number], tankX: number, tankDia: number): Shape[] {
  const z = 90;
  const w = 780;
  const d = 900;
  const pumpZ = 400;
  const top = F + 150 + 1300;
  return [
    box(x, F, z, w, 150, d, { round: 60, roundAxis: "y", cap: 20 }),
    ...pumps.flatMap((px) => [
      cylY(px, F + 150, pumpZ, 270, 560, { cap: 35 }),
      cylY(px, F + 710, pumpZ, 220, 380, { detail: true, cap: 40 }),
    ]),
    ...[
      [x, z],
      [x + w - 60, z],
      [x, z + d - 60],
      [x + w - 60, z + d - 60],
    ].map(([px, pz]) => box(px, F + 150, pz, 60, 1300, 60, { detail: true, round: 22 })),
    box(x, top, z, w, 50, d, { round: 60, roundAxis: "y" }),
    cylY(tankX, top + 50, pumpZ + 50, tankDia, 760, { cap: tankDia * 0.24 }),
  ];
}

const COOLING: PodSpec = {
  id: "cooling",
  title: "Cooling Pod",
  summary: "Duty and standby pumps, heat exchanger and buffer storage for the warm and chilled-water loops.",
  steps: [
    baseStep(),
    frameStep(),
    {
      id: "pw",
      label: "P-W warm-loop pump skid + ET-W",
      tool: "gantry",
      seconds: 3.2,
      parts: [{ id: "pw-skid", shapes: pumpSkid(130, [345, 695], 520, 600) }],
    },
    {
      id: "pc",
      label: "P-C chilled-water pump skid + ET-C",
      tool: "gantry",
      seconds: 3.2,
      parts: [{ id: "pc-skid", shapes: pumpSkid(1040, [1255, 1605], 1430, 760) }],
    },
    {
      id: "hx",
      label: "HX-1 · Plate heat exchanger",
      tool: "arm",
      seconds: 2.2,
      parts: [
        {
          id: "hx-1",
          shapes: [
            box(1915, F, 90, 60, 1550, 800, { round: 25, roundAxis: "x" }),
            box(1975, F + 60, 140, 200, 1420, 700, { detail: true, round: 40, roundAxis: "x" }),
            box(2175, F, 90, 60, 1550, 800, { round: 25, roundAxis: "x" }),
            cylZ(2075, F + 1200, 0, 90, 120, { cap: 18 }),
            cylZ(2075, F + 400, 0, 90, 120, { cap: 18 }),
          ],
        },
      ],
    },
    {
      id: "tanks",
      label: "TK-1 + TK-2 · 3,785 L buffer tanks",
      tool: "gantry",
      seconds: 5,
      parts: [3100, 4878].map((cx, i) => ({
        id: `tk-${i + 1}`,
        shapes: [
          cylY(cx, F, 1069, 1650, 2750, { cap: 280 }),
          cylY(cx, F + 900, 1069, 1660, 20, true),
          cylY(cx, F + 1850, 1069, 1660, 20, true),
          cylZ(cx, F + 2300, 1069 - 825 - 160, 1069 - 825, 300, { cap: 30 }),
        ],
      })),
    },
    {
      id: "loops",
      label: "W + C loop headers",
      tool: "arm",
      seconds: 3.4,
      parts: [
        { id: "hdr-w", motion: "grow-x", shapes: [cylX(200, L - 200, 2650, W - 400, 160, PIPE)] },
        { id: "hdr-c", motion: "grow-x", shapes: [cylX(200, L - 200, 2900, W - 560, 160, PIPE)] },
        { id: "br-w", motion: "grow-z", shapes: [cylZ(520, 2650, 400, W - 400, 120, PIPE)] },
        { id: "br-c", motion: "grow-z", shapes: [cylZ(1430, 2900, 400, W - 560, 120, PIPE)] },
      ],
    },
    wallsStep(
      "Wall panels + tank manway hatches",
      [
        box(2600, F + 400, -8, 1000, 1000, 8, { ...PLATE, round: 500 }),
        box(4380, F + 400, -8, 1000, 1000, 8, { ...PLATE, round: 500 }),
      ],
      3990,
    ),
    dryCoolerRoofStep(),
  ],
};

// ---------------------------------------------------------------------------
// Compute pod: 10 racks (8 compute + 2 central), busways, headers, fiber
// ---------------------------------------------------------------------------

const RACK = { x0: M + 129, pitch: 550, z: M + 243, depth: 1295, height: 2258, rdhx: 400 };
const RACK_ROLES = ["C01", "C02", "C03", "C04", "NS01", "NS02", "C05", "C06", "C07", "C08"] as const;

function rack(i: number): Part {
  const x = RACK.x0 + i * RACK.pitch;
  const central = RACK_ROLES[i].startsWith("NS");
  const face = x + (RACK.pitch - 482.6) / 2;
  const front = RACK.z - 10;
  return {
    id: `rack-${RACK_ROLES[i]}`,
    shapes: [
      box(x, F, RACK.z, RACK.pitch, RACK.height, RACK.depth, { round: 30, roundAxis: "y", cap: 15 }),
      box(x, F, RACK.z + RACK.depth, RACK.pitch, RACK.height, RACK.rdhx, { detail: true, round: 30, roundAxis: "y" }),
      ...(central
        ? [0, 1, 2, 3, 4].map((k) => box(face, F + 300 + k * 380, front, 482.6, 180, 10, { ...PLATE, round: 24 }))
        : [box(face, F + 60, front, 482.6, RACK.height - 120, 10, PLATE)]),
    ],
  };
}

/** Radius of the service roof's curved top edges. */
const ROOF_CURVE = 520;

const RUN_X0 = M + 129;
const RUN_X1 = L - M - 129;

const COMPUTE: PodSpec = {
  id: "compute",
  title: "Compute Pod",
  summary: "Ten liquid-cooled racks with rear-door heat exchangers, A/B busways and segregated fiber.",
  steps: [
    baseStep(),
    frameStep(),
    {
      id: "racks",
      label: "10 racks · 8 compute + 2 central",
      tool: "arm",
      seconds: 7,
      parts: Array.from({ length: 10 }, (_, i) => rack(i)),
    },
    {
      id: "busways",
      label: "A/B busways · 2 x 1,250 A",
      tool: "arm",
      seconds: 2.4,
      parts: [
        { id: "bus-a", motion: "grow-x", shapes: [box(RUN_X0, F + 3045, M + 400 - 75, RUN_X1 - RUN_X0, 129, 150, { round: 30 })] },
        { id: "bus-b", motion: "grow-x", shapes: [box(RUN_X0, F + 3045, M + 950 - 75, RUN_X1 - RUN_X0, 129, 150, { round: 30 })] },
      ],
    },
    {
      id: "headers",
      label: "Liquid-cooling headers · DTC + CHW",
      tool: "arm",
      seconds: 3,
      parts: [
        { id: "w-sup", motion: "grow-x", shapes: [cylX(RUN_X0, RUN_X1, F + 2820, M + 1850, 191, PIPE)] },
        { id: "c-sup", motion: "grow-x", shapes: [cylX(RUN_X0, RUN_X1, F + 2820, M + 2060, 164, PIPE)] },
        { id: "w-ret", motion: "grow-x", shapes: [cylX(RUN_X0, RUN_X1, F + 3065, M + 1850, 191, PIPE)] },
        { id: "c-ret", motion: "grow-x", shapes: [cylX(RUN_X0, RUN_X1, F + 3065, M + 2060, 164, PIPE)] },
      ],
    },
    {
      id: "fiber",
      label: "Segregated fiber trays",
      tool: "arm",
      seconds: 2.2,
      parts: [
        { id: "tray-a", motion: "grow-x", shapes: [box(RUN_X0, F + 2900, M + 1270, RUN_X1 - RUN_X0, 100, 300, { round: 20 })] },
        { id: "tray-b", motion: "grow-x", shapes: [box(RUN_X0, F + 3070, M + 1270, RUN_X1 - RUN_X0, 60, 300, { round: 20 })] },
      ],
    },
    wallsStep(
      "Front service panels",
      Array.from({ length: 10 }, (_, i) => {
        const pw = (L - 300 - 9 * 40) / 10;
        return box(150 + i * (pw + 40), F + 50, -8, pw, POST_H - 100, 8, { ...PLATE, round: 70 });
      }),
      L / 2,
      "left",
    ),
    {
      id: "roof",
      label: "Insulated service roof",
      tool: "gantry",
      seconds: 3.4,
      parts: [
        {
          id: "service-roof",
          shapes: [
            roofLoft(POD.height, 1600, ROOF_CURVE, "left"),
            ...[1, 2, 3, 4, 5].map((k) =>
              box((L / 6) * k - 15, POD.height + 1600, ROOF_CURVE - CLAD, 30, 12, W + 2 * CLAD - 2 * ROOF_CURVE, {
                detail: true,
              }),
            ),
          ],
        },
      ],
    },
  ],
};

/** In build (and row) order: electrical, cooling, compute. */
export const PODS: readonly PodSpec[] = [ELECTRICAL, COOLING, COMPUTE];
