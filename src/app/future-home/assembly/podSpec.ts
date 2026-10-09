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

export interface Shape {
  kind: "box" | "cyl";
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

/**
 * Rear, end and front wall panels. Ordered so the front panels close last
 * and alternate between the front (even) and rear (odd) robot arms.
 */
function wallsStep(label: string, frontDetail: Shape[] = []): BuildStep {
  const half = L / 2 - M - M / 2;
  const right = L / 2 + M / 2;
  const h = POST_H;
  const frontA = box(M, F, 0, half, h, 60);
  const frontB = box(right, F, 0, half, h, 60);
  return {
    id: "walls",
    label,
    tool: "arm",
    seconds: 4.2,
    parts: [
      { id: "end-l", shapes: [box(0, F, M, 60, h, W - 2 * M)] },
      { id: "rear-b", shapes: [box(right, F, W - 60, half, h, 60)] },
      { id: "front-a", shapes: [frontA, ...frontDetail.filter((s) => s.x < L / 2)] },
      { id: "rear-a", shapes: [box(M, F, W - 60, half, h, 60)] },
      { id: "front-b", shapes: [frontB, ...frontDetail.filter((s) => s.x >= L / 2)] },
      { id: "end-r", shapes: [box(L - 60, F, M, 60, h, W - 2 * M)] },
    ],
  };
}

/** Dry-cooler roof module: deck, posts, V-coil banks and 12 EC fans (2 x 6). */
function dryCoolerRoofStep(): BuildStep {
  const y0 = POD.height;
  const coilLen = 5520;
  const slant = 1093;
  const thick = 128;
  const rise = 1050 - 250;
  const tilt = Math.acos(rise / slant);
  const run = slant * Math.sin(tilt);
  const coilY = y0 + (250 + 1050) / 2 - slant / 2;
  const coilX = (L - coilLen) / 2;
  const coil = (side: 1 | -1) =>
    box(coilX, coilY, W / 2 - side * (run / 2 + 120) - thick / 2, coilLen, slant, thick, {
      tilt: side * tilt,
      detail: true,
      round: 40,
      roundAxis: "x",
    });

  const frame = 970;
  const fans: Shape[] = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 6; c++) {
      const fx = 69 + c * (frame + 20);
      const fz = 209 + r * (frame + 80);
      fans.push(
        box(fx, y0 + 1480, fz, frame, 20, frame, { detail: true, round: 90, roundAxis: "y" }),
        cylY(fx + frame / 2, y0 + 1500, fz + frame / 2, 857, 80, { cap: 24 }),
        cylY(fx + frame / 2, y0 + 1590, fz + frame / 2, 800, 10, true),
      );
    }
  }

  return {
    id: "roof",
    label: "Dry-cooler roof: V-coils + 12 EC fans",
    tool: "gantry",
    seconds: 4.4,
    parts: [
      {
        id: "dry-cooler",
        shapes: [
          box(0, y0, 0, L, 200, W, { bevel: 60 }),
          box(0, y0 + 200, 0, 100, 1280, 100, { round: 30 }),
          box(L - 100, y0 + 200, 0, 100, 1280, 100, { round: 30 }),
          box(0, y0 + 200, W - 100, 100, 1280, 100, { round: 30 }),
          box(L - 100, y0 + 200, W - 100, 100, 1280, 100, { round: 30 }),
          box(100, y0 + 200, 0, L - 200, 1170, 20, { detail: true, ghost: true }),
          box(100, y0 + 200, W - 20, L - 200, 1170, 20, { detail: true, ghost: true }),
          box(0, y0 + 1370, 0, L, 30, 209, { round: 14 }),
          box(0, y0 + 1370, W - 209, L, 30, 209, { round: 14 }),
          coil(1),
          coil(-1),
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
    wallsStep("Wall panels + access doors", [
      box(500, 2300, -8, 1300, 600, 8, { ...PLATE, round: 90 }),
      box(3700, F + 100, -8, 1000, 2100, 8, { ...PLATE, round: 90 }),
    ]),
    dryCoolerRoofStep(),
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
    wallsStep("Wall panels + tank manway hatches", [
      box(2600, F + 400, -8, 1000, 1000, 8, { ...PLATE, round: 500 }),
      box(4380, F + 400, -8, 1000, 1000, 8, { ...PLATE, round: 500 }),
    ]),
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
            box(0, POD.height, 0, L, 1600, W, { round: 300, roundAxis: "x" }),
            ...[1, 2, 3, 4, 5].map((k) => box((L / 6) * k - 15, POD.height + 1600, 0, 30, 12, W, { detail: true })),
          ],
        },
      ],
    },
  ],
};

/** In build (and row) order: electrical, cooling, compute. */
export const PODS: readonly PodSpec[] = [ELECTRICAL, COOLING, COMPUTE];
