import type { ReactElement } from "react";
import { Sketch, round, type Bounds, type P3 } from "../lineart";
import type { PodId } from "./podTour";
import styles from "./PodTour.module.css";

/*
 * Line drawing of a ZODE cabin, mirrored from the "compute hall" render so
 * the glazed gable and its deck sit on the left: a glass box inside a heavy
 * charcoal ring frame whose apex and eaves are rounded, with a three-panel
 * roof that rolls over the eave into a dark fascia. Model units: x across the
 * cabin (+x is the long glazed side facing the viewer), y along it (+y toward
 * the gable end), z up. The camera sits lower than the shared dimetric view
 * so the equipment reads through the glazing instead of hiding under the roof.
 */

const AZIMUTH = (40 * Math.PI) / 180;
const ELEVATION = (14 * Math.PI) / 180;
const [SA, CA, SE, CE] = [Math.sin(AZIMUTH), Math.cos(AZIMUTH), Math.sin(ELEVATION), Math.cos(ELEVATION)];
/** Unit vector toward the viewer. */
const EYE = [CE * CA, CE * SA, SE] as const;

function view([x, y, z = 0]: P3): [number, number] {
  return [round(x * SA - y * CA), round((x * CA + y * SA) * SE - z * CE)];
}

const HW = 54;
const HL = 120;
/** Top of the floor slab and of the frame's sill. */
const BASE = 6;
/** Top of the long side's glazing, where the fascia starts. */
const GLASS = 66;
/** Where the walls and roof slopes would meet if the eaves were square. */
const EAVE = 76;
const RIDGE = 116;
const SLOPE = (RIDGE - EAVE) / HW;
/** Corner radii on the outside of the frame; inset outlines keep the same centres down to `R_MIN`. */
const R_EAVE = 6;
const R_APEX = 8;
const R_MIN = 2.5;
/** Half-width of the flat crown that caps the gable between its two softened ridge corners. */
const CROWN = 7;
/** Share of each roof slope, from the eave up, clad in the dark band that wraps the bullnose. */
const BAND = 0.3;
/** Drop from the roof's outer skin to the ceiling. */
const ROOF_T = 6;
/** Width of the charcoal frame members. */
const FRAME = 7;
/** Plane of the long side's glazing, set back inside the posts and fascia. */
const GX = HW - 2;
const POSTS = [-120, -80, -40, 0, 40, 120];
const POST = 5;
const DOOR = { y0: 54, y1: 78, top: 40 };
/** The glass partition on this post line closes off the operations room at the gable end; the equipment hall lies beyond it. */
const NOC = 40;
const DECK = { length: 56, wall: 22 };

/** Half the spacing between the two fiber routes' parallel floor lanes. */
const LANE = 1.5;

export interface Layer {
  key: string;
  /** Hotspot id this layer highlights with; static layers have none. */
  zone?: string;
  /** Pod-specific equipment, remounted (and faded in) when the pod changes. */
  interior?: boolean;
  items: ReactElement[];
}

/** Screen-space extent of everything drawn. */
const extent = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };

function grow(x: number, y: number): void {
  extent.x0 = Math.min(extent.x0, x);
  extent.y0 = Math.min(extent.y0, y);
  extent.x1 = Math.max(extent.x1, x);
  extent.y1 = Math.max(extent.y1, y);
}

function layer(key: string, zone: string | undefined, draw: (s: Sketch) => void, interior = false): Layer {
  const s = new Sketch(styles, view);
  draw(s);
  const b = s.bounds();
  if (Number.isFinite(b.w)) {
    grow(b.x, b.y);
    grow(b.x + b.w, b.y + b.h);
  }
  return { key, zone, interior, items: s.items };
}

const rectX = (s: Sketch, x: number, y0: number, y1: number, z0: number, z1: number, cls: string) =>
  s.face(
    [
      [x, y0, z0],
      [x, y1, z0],
      [x, y1, z1],
      [x, y0, z1],
    ],
    cls,
  );

const rectY = (s: Sketch, y: number, x0: number, x1: number, z0: number, z1: number, cls: string) =>
  s.face(
    [
      [x0, y, z0],
      [x1, y, z0],
      [x1, y, z1],
      [x0, y, z1],
    ],
    cls,
  );

const FRAMED = { top: styles.frame, sideL: styles.frame, sideR: styles.frame };

// ---------------------------------------------------------------------------
// Cylinders
// ---------------------------------------------------------------------------

type Axis = "x" | "y" | "z";
type V3 = readonly [number, number, number];

const AXES: Record<Axis, { a: V3; u: V3; w: V3 }> = {
  x: { a: [1, 0, 0], u: [0, 1, 0], w: [0, 0, 1] },
  y: { a: [0, 1, 0], u: [1, 0, 0], w: [0, 0, 1] },
  z: { a: [0, 0, 1], u: [1, 0, 0], w: [0, 1, 0] },
};

const dot = (p: V3, q: V3) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];

function along([x, y, z = 0]: P3, axis: Axis, d: number): P3 {
  const { a } = AXES[axis];
  return [x + a[0] * d, y + a[1] * d, z + a[2] * d];
}

function arc([x, y, z = 0]: P3, axis: Axis, r: number, from: number, to: number, n = 24): P3[] {
  const { u, w } = AXES[axis];
  const pts: P3[] = [];
  for (let k = 0; k <= n; k++) {
    const t = from + ((to - from) * k) / n;
    const [cu, sw] = [r * Math.cos(t), r * Math.sin(t)];
    pts.push([x + u[0] * cu + w[0] * sw, y + u[1] * cu + w[1] * sw, z + u[2] * cu + w[2] * sw]);
  }
  return pts;
}

/** Angle round `axis` of the barrel line that faces the viewer squarely. */
function facing(axis: Axis): number {
  const { u, w } = AXES[axis];
  return Math.atan2(dot(w, EYE), dot(u, EYE));
}

const circle = (s: Sketch, c: P3, axis: Axis, r: number, cls: string) =>
  s.face(arc(c, axis, r, 0, Math.PI * 2, 48), cls);

/** Solid cylinder from the centre of its low end; every axis points toward the viewer, so the far cap stays hidden. */
function cylinder(s: Sketch, c: P3, axis: Axis, r: number, len: number, body = styles.sideR): void {
  const t = facing(axis);
  const end = along(c, axis, len);
  s.face(
    [...arc(c, axis, r, t - Math.PI / 2, t + Math.PI / 2), ...arc(end, axis, r, t - Math.PI / 2, t + Math.PI / 2).reverse()],
    body,
  );
  circle(s, end, axis, r, styles.top);
}

/** Visible half of a hoop round a cylinder, `d` along its axis. */
function hoop(s: Sketch, c: P3, axis: Axis, r: number, d: number): void {
  const t = facing(axis);
  s.line(arc(along(c, axis, d), axis, r, t - Math.PI / 2, t + Math.PI / 2));
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

/** A point in a gable's plane: x across the cabin, z up. */
type P2 = readonly [number, number];

const at =
  (y: number) =>
  ([x, z]: P2): P3 => [x, y, z];

/** Arc rounding the corner at `b` between the straight runs from `a` and to `c`, from tangent point to tangent point. */
function fillet(a: P2, b: P2, c: P2, r: number, n = 14): P2[] {
  const unit = ([x, z]: P2): P2 => [x / Math.hypot(x, z), z / Math.hypot(x, z)];
  const u = unit([a[0] - b[0], a[1] - b[1]]);
  const v = unit([c[0] - b[0], c[1] - b[1]]);
  const half = Math.acos(u[0] * v[0] + u[1] * v[1]) / 2;
  const m = unit([u[0] + v[0], u[1] + v[1]]);
  const d = r / Math.sin(half);
  const o: P2 = [b[0] + m[0] * d, b[1] + m[1] * d];
  const t = r / Math.tan(half);
  const angle = (s: P2) => Math.atan2(b[1] + s[1] * t - o[1], b[0] + s[0] * t - o[0]);
  const from = angle(u);
  let sweep = angle(v) - from;
  if (sweep > Math.PI) sweep -= 2 * Math.PI;
  if (sweep < -Math.PI) sweep += 2 * Math.PI;
  return Array.from({ length: n + 1 }, (_, k): P2 => {
    const q = from + (sweep * k) / n;
    return [o[0] + r * Math.cos(q), o[1] + r * Math.sin(q)];
  });
}

interface Profile {
  x: number;
  z0: number;
  /** Rounded corners, each running counter-clockwise: +x eave, the crown's two ridge corners, -x eave. */
  right: P2[];
  apex: P2[];
  left: P2[];
}

/** Gable outline inset by `k` (0 is the outside of the frame): flat-crowned, its corners rounded about fixed centres. */
function profile(k: number, z0 = k ? BASE : 0): Profile {
  const x = HW - k;
  const eave = RIDGE - k * Math.hypot(1, SLOPE) - SLOPE * x;
  const crown = eave + SLOPE * (x - CROWN);
  const re = Math.max(R_EAVE - k, R_MIN);
  const ra = Math.max(R_APEX - k, R_MIN);
  return {
    x,
    z0,
    right: fillet([x, z0], [x, eave], [CROWN, crown], re),
    apex: [...fillet([x, eave], [CROWN, crown], [-CROWN, crown], ra), ...fillet([CROWN, crown], [-CROWN, crown], [-x, eave], ra)],
    left: fillet([-CROWN, crown], [-x, eave], [-x, z0], re),
  };
}

const loop = (p: Profile): P2[] => [[p.x, p.z0], ...p.right, ...p.apex, ...p.left, [-p.x, p.z0]];

const OUTER = profile(0);
const INNER = profile(FRAME);
/** Reveal between the ring and the gable window's own slim frame, and that frame's width. */
const GAP = 2;
const SASH = 1.8;
const SASH_OUT = profile(FRAME + GAP, BASE + GAP);
const SASH_IN = profile(FRAME + GAP + SASH, BASE + GAP + SASH);
/** Where the inner opening's straight sides start to round into the eaves. */
const SHOULDER = INNER.right[0][1];

/** Leading run of `chain` whose outward faces (the chain runs counter-clockwise) are turned toward the viewer. */
function facingRun(chain: P2[]): P2[] {
  let n = 1;
  while (n < chain.length) {
    const [dx, dz] = [chain[n][0] - chain[n - 1][0], chain[n][1] - chain[n - 1][1]];
    if (dz * EYE[0] - dx * EYE[2] <= 0) break;
    n++;
  }
  return chain.slice(0, n);
}

const lerp = (a: P2, b: P2, t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** Top of the dark band on the near roof slope. */
const BAND_TOP = lerp(OUTER.right[OUTER.right.length - 1], OUTER.apex[0], BAND);
const NOSE = Math.floor(OUTER.right.length / 2);
/** Frame fascia of the long side, from the glazing up to the crest of the eave bullnose. */
const FASCIA: P2[] = [[HW, GLASS], ...OUTER.right.slice(0, NOSE + 1)];
/** The roof's lower, darker tone: from the bullnose crest over the eave and up the slope. */
const EAVE_BAND: P2[] = [...OUTER.right.slice(NOSE), BAND_TOP];
/** Where the near slope rounds over onto the flat crown. */
const CREST = OUTER.apex[7];
/** The roof's light panels, from the dark band up to the ridge's silhouette. */
const ROOF: P2[] = facingRun([BAND_TOP, ...OUTER.apex, ...OUTER.left]);
/** Underside of the far roof slope, from the ridge down round the eave to the back wall. */
const CEILING: P2[] = [...OUTER.apex.filter(([x]) => x <= 1e-9), ...OUTER.left].map(([x, z]): P2 => [x, z - ROOF_T]);

/** A strip of skin swept along y from `y0` to `y1`. */
const extrude = (s: Sketch, chain: P2[], y0: number, y1: number, cls: string) =>
  s.face([...chain.map(at(y1)), ...chain.map(at(y0)).reverse()], cls);

/** Charcoal ring round a gable end, and inside it, past a narrow reveal, the window's own slim frame. */
function gableFrame(s: Sketch, y: number): void {
  const ring = (p: Profile) =>
    `M${loop(p)
      .map((q) => view(at(y)(q)).join(" "))
      .join("L")}Z`;
  s.el("path", { d: ring(SASH_OUT) + ring(SASH_IN), className: styles.frame, fillRule: "evenodd" });
  s.el("path", { d: ring(OUTER) + ring(INNER), className: styles.frame, fillRule: "evenodd" });
}

const GABLE_MULLION = 22;

/**
 * Glazing bars inside a gable, each running into the window frame: two
 * mullions up to the slopes, a heavy transom above the shoulders, a door-head
 * transom across the opening and a double door in the middle bay.
 */
function gableBars(s: Sketch, y: number): void {
  const [w, transom, sill] = [1.2, SHOULDER + 8, SASH_IN.z0];
  const apex = RIDGE - (FRAME + GAP + SASH) * Math.hypot(1, SLOPE);
  /** Just inside the window frame, so the bars tuck under it without a gap. */
  const under = (x: number) => apex + 0.6 - SLOPE * Math.abs(x);
  const across = (z: number) => (apex + 0.6 - z) / SLOPE;
  for (const x of [-GABLE_MULLION, GABLE_MULLION]) {
    s.face(
      [
        [x - w, y, sill],
        [x + w, y, sill],
        [x + w, y, under(x + w)],
        [x - w, y, under(x - w)],
      ],
      styles.frame,
    );
  }
  const [lo, hi] = [transom - 2.4, transom];
  s.face(
    [
      [-across(lo), y, lo],
      [across(lo), y, lo],
      [across(hi), y, hi],
      [-across(hi), y, hi],
    ],
    styles.frame,
  );
  rectY(s, y, -SASH_IN.x, SASH_IN.x, DOOR.top - 0.8, DOOR.top + 0.8, styles.frame);
  rectY(s, y, -0.7, 0.7, sill, DOOR.top, styles.frame);
  for (const x of [-2.4, 2.4]) s.line([[x, y, 20], [x, y, 28]], styles.edge);
}

/** Box posts along a long side, standing between `x0` and `x1`. */
function posts(s: Sketch, x0: number, x1: number): void {
  for (const y of POSTS) {
    const w = Math.abs(y) === HL ? FRAME : POST;
    const y0 = Math.min(Math.max(y - w / 2, -HL), HL - w);
    s.box(x0, y0, x1 - x0, w, BASE, GLASS - BASE, FRAMED);
  }
}

function back(s: Sketch): void {
  s.face(
    [
      [-HW - 6, -HL - 6],
      [HW + 14, -HL - 6],
      [HW + 14, HL + DECK.length + 8],
      [-HW - 6, HL + DECK.length + 8],
    ],
    styles.shadow,
  );
  s.box(-HW, -HL, 2 * HW, 2 * HL, 0, BASE);

  const x = -HW + 0.2;
  const top = CEILING[CEILING.length - 1][1];
  rectX(s, x, -HL, NOC, BASE, top, styles.wall);

  // The operations room is lined in timber, floor and back wall, with LED strips on the wall.
  s.face(
    [
      [-HW, NOC, BASE],
      [HW, NOC, BASE],
      [HW, HL, BASE],
      [-HW, HL, BASE],
    ],
    styles.wood,
  );
  for (let xx = -HW + 6; xx < HW; xx += 6) s.line([[xx, NOC, BASE], [xx, HL, BASE]], styles.hair);
  rectX(s, x, NOC, HL, BASE, top, styles.wood);
  for (const y of [72, 98]) rectX(s, x + 0.2, y, y + 1.2, 28, 40, styles.led);

  posts(s, -HW, -HW + 1.5);

  extrude(s, CEILING, -HL, HL, styles.under);
  for (const yy of [-HL / 3, HL / 3]) s.line(CEILING.map(at(yy)));

  const y = -HL + 0.2;
  s.face(loop(INNER).map(at(y)), styles.wallEnd);
  gableBars(s, y);
  gableFrame(s, y);
}

/** Underside of the ceiling at `x`, along the straight run of either slope. */
const ceilingAt = (x: number) => RIDGE - ROOF_T - SLOPE * Math.abs(x);

/** Operations room: a framed glass partition across the cabin with a door, and a long desk facing the gable. */
function noc(s: Sketch): void {
  const y = NOC;
  const head = [...OUTER.right, ...OUTER.apex, ...OUTER.left].map(([x, z]): P2 => [x, z - ROOF_T]);
  s.face([[-HW, BASE] as P2, [HW, BASE] as P2, ...head].map(at(y)), styles.glass);
  s.line(head.map(at(y)), styles.edge);
  rectY(s, y, -HW, HW, BASE, BASE + 1.6, styles.frame);
  for (const x of [-32, -12, 10, 30]) {
    s.face(
      [
        [x - 1.4, y, BASE],
        [x + 1.4, y, BASE],
        [x + 1.4, y, ceilingAt(x + 1.4)],
        [x - 1.4, y, ceilingAt(x - 1.4)],
      ],
      styles.frame,
    );
  }
  rectY(s, y, -HW, HW, DOOR.top - 0.8, DOOR.top + 0.8, styles.frame);
  s.line([[-9, y, 18], [-9, y, 28]], styles.edge);

  const [d0, d1, x0, x1, z] = [84, 94, -44, 4, BASE + 18];
  for (const xx of [x0, x1 - 1.5]) s.box(xx, d0, 1.5, d1 - d0, BASE, z - BASE, FRAMED);
  s.box(x0, d0, x1 - x0, d1 - d0, z, 1.5);
  for (const xx of [-38, -24, -10]) {
    s.box(xx, d0 + 2, 11, 1.2, z + 3.5, 7, FRAMED);
    s.box(xx + 5, d0 + 2.5, 1, 1, z + 1.5, 2, FRAMED);
  }
  s.box(-26, d1 + 6, 8, 8, BASE + 10, 1.5);
  s.box(-26, d1 + 12.5, 8, 1.5, BASE + 11.5, 9);
  s.line([[-22, d1 + 10, BASE], [-22, d1 + 10, BASE + 10]], styles.edge);
}

/** One glazing bar on the long side's glass. */
const bar = (s: Sketch, y0: number, y1: number, z0: number, z1: number) => rectX(s, GX, y0, y1, z0, z1, styles.frame);

function facade(s: Sketch): void {
  rectX(s, GX, -HL, HL, BASE, GLASS, styles.glass);
  s.face(loop(INNER).map(at(HL)), styles.glass);

  const transom = (y0: number, y1: number) => bar(s, y0, y1, DOOR.top - 0.8, DOOR.top + 0.8);
  transom(POSTS[4] + POST / 2, HL - FRAME);
  for (const y of [DOOR.y0, DOOR.y1]) bar(s, y - 0.8, y + 0.8, BASE, GLASS);
  s.line([[GX, DOOR.y0 + 3, 18], [GX, DOOR.y0 + 3, 28]], styles.edge);

  const far = [
    [-HL + FRAME, POSTS[1] - POST / 2, -90],
    [POSTS[1] + POST / 2, POSTS[2] - POST / 2, -50],
  ];
  for (const [y0, y1, m] of far) {
    transom(y0, y1);
    bar(s, m - 0.7, m + 0.7, BASE, GLASS);
  }

  rectX(s, HW, -HL, HL, 0, BASE, styles.frame);
  posts(s, HW - 3, HW);
  extrude(s, FASCIA, -HL, HL, styles.frame);

  gableBars(s, HL);
  gableFrame(s, HL);
}

function roof(s: Sketch): void {
  extrude(s, EAVE_BAND, -HL, HL, styles.band);
  extrude(s, ROOF, -HL, HL, styles.roof);
  for (const y of [-HL / 3, HL / 3]) s.line(ROOF.map(at(y)), styles.edge);
  s.line([at(-HL)(CREST), at(HL)(CREST)]);
}

/** Deck off the glazed gable: solid charcoal side walls with a frameless glass balustrade across the end. */
function deck(s: Sketch): void {
  const [y0, y1, h, t] = [HL, HL + DECK.length, DECK.wall, 2];
  s.box(-HW, y0, 2 * HW, y1 - y0, 0, 2);
  for (let x = -HW + 6; x < HW - t; x += 6) s.line([[x, y0, 2], [x, y1, 2]], styles.hair);
  s.box(-HW, y0, t, y1 - y0, 0, h, FRAMED);
  rectY(s, y1 - 0.5, -HW + t, HW - t, 2, h, styles.glass);
  s.line([[-HW + t, y1 - 0.5, h], [HW - t, y1 - 0.5, h]], styles.edge);
  s.box(HW - t, y0, t, y1 - y0, 0, h, FRAMED);
}

// ---------------------------------------------------------------------------
// Fiber
// ---------------------------------------------------------------------------

/*
 * Both routes leave the pod side by side through the foot of the glazed side,
 * straight below the middle of the drawing (`DROP_Y`). Outside, the page's
 * circuit frame carries them down into its grid, A turning west and B east
 * (see `DROP`); inside, they keep to parallel floor lanes all the way to the
 * equipment, A on the far one so the two never cross. Every pod's target must
 * lie toward the hall (lower y than `DROP_Y`) and inboard of its lane.
 */
function runs(pod: PodId, laneX: number, target: [number, number]): Layer[] {
  const [tx, ty] = target;
  const run = (side: -1 | 1) => (s: Sketch) =>
    s.line(
      [
        [HW - 6, DROP_Y + side * LANE, BASE],
        [laneX - side * LANE, DROP_Y + side * LANE, BASE],
        [laneX - side * LANE, ty + side * LANE, BASE],
        [tx, ty + side * LANE, BASE],
      ],
      styles.run,
    );
  return [layer(`${pod}-run-a`, "fiber-a", run(1), true), layer(`${pod}-run-b`, "fiber-b", run(-1), true)];
}

// ---------------------------------------------------------------------------
// Pods
// ---------------------------------------------------------------------------

/** Ten racks in one row along the back wall, ending short of the operations room partition. */
const RACK = { x: -46, depth: 30, width: 12.5, pitch: 13.5, height: 39, y0: -100 };
const rackY = (i: number) => RACK.y0 + i * RACK.pitch;

function rack(s: Sketch, i: number, spine: boolean): void {
  const y = rackY(i);
  const fx = RACK.x + RACK.depth;
  s.box(RACK.x, y, RACK.depth, RACK.width, BASE, RACK.height);
  if (spine) {
    for (let k = 0; k < 5; k++) {
      const z = BASE + 6 + k * 7;
      rectX(s, fx, y + 2.2, y + RACK.width - 2.2, z, z + 3, styles.ink);
    }
    return;
  }
  rectX(s, fx, y + 1.8, y + RACK.width - 1.8, BASE + 3, BASE + RACK.height - 3, styles.fine);
  for (let z = BASE + 7; z < BASE + RACK.height - 4; z += 3.5) s.line([[fx, y + 3.2, z], [fx, y + RACK.width - 3.2, z]], styles.hair);
}

function compute(): Layer[] {
  const racks = (from: number, to: number) => (s: Sketch) => {
    for (let i = from; i < to; i++) rack(s, i, false);
  };
  return [
    layer(
      "compute-cdu",
      "coolant",
      (s) => {
        const [x, y, w, d, h] = [-46, -118, 30, 16, 38];
        s.box(x, y, w, d, BASE, h);
        for (let z = BASE + 6; z < BASE + 25; z += 3) s.line([[x + w, y + 3, z], [x + w, y + d - 3, z]], styles.hair);
        rectX(s, x + w, y + 4, y + d - 4, BASE + 29, BASE + 34, styles.sideL);
      },
      true,
    ),
    layer("compute-racks-a", "racks", racks(0, 4), true),
    layer(
      "compute-spine",
      "spine",
      (s) => {
        rack(s, 4, true);
        rack(s, 5, true);
      },
      true,
    ),
    layer("compute-racks-b", "racks", racks(6, 10), true),
    layer(
      "compute-manifold",
      "coolant",
      (s) => {
        for (let i = 0; i < 10; i++) {
          const y = rackY(i) + RACK.width / 2;
          s.line([[-16, y, BASE + 3], [-12, y, BASE + 3]], styles.edge);
        }
        const len = rackY(9) + RACK.width + 2 + 102;
        cylinder(s, [-12, -102, BASE + 3], "y", 2, len);
        cylinder(s, [-7, -102, BASE + 3], "y", 2, len);
      },
      true,
    ),
    ...runs("compute", -1, [-16, rackY(5)]),
  ];
}

function electrical(): Layer[] {
  return [
    layer(
      "electrical-transformer",
      "transformer",
      (s) => {
        s.box(-42, -116, 52, 50, BASE, 4);
        for (const y of [-106, -91, -76]) {
          const c: P3 = [-16, y, BASE + 4];
          cylinder(s, c, "z", 7, 28);
          hoop(s, c, "z", 7, 9);
          hoop(s, c, "z", 7, 19);
        }
        s.box(-22, -114, 12, 46, BASE + 32, 5);
      },
      true,
    ),
    layer(
      "electrical-fans",
      "fans",
      (s) => {
        const y = -HL + 0.6;
        rectY(s, y, 14, 45, 10, 34, styles.sideL);
        for (const x of [22, 37]) {
          const c: P3 = [x, y + 0.2, 22];
          circle(s, c, "y", 7, styles.top);
          circle(s, c, "y", 1.8, styles.ink);
          for (let k = 0; k < 3; k++) {
            const t = (k / 3) * Math.PI * 2 + 0.5;
            s.line([c, [x + 6 * Math.cos(t), y + 0.2, 22 + 6 * Math.sin(t)]], styles.edge);
          }
        }
      },
      true,
    ),
    layer(
      "electrical-switchboard",
      "switchboard",
      (s) => {
        for (let i = 0; i < 3; i++) {
          const y = -62 + i * 20;
          const fx = -22;
          s.box(-48, y, 26, 19, BASE, 38);
          rectX(s, fx, y + 2, y + 17, BASE + 3, BASE + 35, styles.fine);
          rectX(s, fx, y + 5, y + 14, BASE + 27, BASE + 31, styles.sideL);
          s.line([[fx, y + 14.5, BASE + 14], [fx, y + 14.5, BASE + 20]], styles.edge);
        }
      },
      true,
    ),
    layer(
      "electrical-ups",
      "ups",
      (s) => {
        s.box(-48, -2, 26, 18, BASE, 34);
        rectX(s, -22, 1, 13, BASE + 24, BASE + 29, styles.ink);
        rectX(s, -22, 0.5, 13.5, BASE + 3, BASE + 20, styles.fine);
        s.box(-48, 17, 26, 18, BASE, 34);
        for (let k = 0; k < 5; k++) {
          const z = BASE + 4 + k * 5.8;
          rectX(s, -22, 19.5, 32.5, z, z + 4.3, styles.fine);
        }
      },
      true,
    ),
    ...runs("electrical", 14, [-22, -32]),
  ];
}

function cooling(): Layer[] {
  const skid = (s: Sketch, y0: number) => {
    s.box(-40, y0, 30, 26, BASE, 3);
    for (const y of [y0 + 7, y0 + 19]) {
      cylinder(s, [-25, y, BASE + 3], "z", 4.5, 11);
      cylinder(s, [-25, y, BASE + 14], "z", 3.4, 8, styles.sideL);
    }
  };
  return [
    layer(
      "cooling-tanks",
      "tanks",
      (s) => {
        for (const y of [-98, -60]) {
          const c: P3 = [-32, y, BASE];
          cylinder(s, c, "z", 17, 40);
          hoop(s, c, "z", 17, 13);
          hoop(s, c, "z", 17, 27);
        }
      },
      true,
    ),
    layer(
      "cooling-pumps",
      "pumps",
      (s) => {
        skid(s, -40);
        skid(s, -12);
      },
      true,
    ),
    layer(
      "cooling-hx",
      "hx",
      (s) => {
        s.box(-46, 16, 22, 3, BASE, 32);
        s.box(-44, 19, 18, 14, BASE + 2, 28);
        for (let y = 21; y < 33; y += 2) s.line([[-26, y, BASE + 3], [-26, y, BASE + 29]], styles.hair);
        s.box(-46, 33, 22, 3, BASE, 32);
        s.box(-46, 16, 3, 20, BASE + 32, 2);
      },
      true,
    ),
    layer(
      "cooling-controls",
      "pumps",
      (s) => {
        s.box(8, -118, 16, 14, BASE, 32);
        rectY(s, -104, 10, 22, BASE + 3, BASE + 29, styles.fine);
        rectY(s, -104, 12, 20, BASE + 22, BASE + 26, styles.ink);
      },
      true,
    ),
    layer(
      "cooling-headers",
      "headers",
      (s) => {
        for (const y of [-98, -60, -33, -21, -5, 7, 26]) cylinder(s, [-10, y, BASE + 4], "x", 1.6, 6);
        cylinder(s, [-4, -116, BASE + 4], "y", 2.4, 150);
        cylinder(s, [2, -116, BASE + 4], "y", 2.4, 150, styles.sideL);
      },
      true,
    ),
    ...runs("cooling", 30, [16, -104]),
  ];
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

const SHELL_BACK = layer("shell-back", undefined, back);
const SHELL_FRONT = [
  layer("noc", "noc", noc),
  layer("facade", "facade", facade),
  layer("roof", "roof", roof),
  layer("deck", "deck", deck),
];
/** Along the glazed side, where its foot sits below the drawing's middle; the equipment all stays inside the shell's extent. */
const DROP_Y = round((HW * SA - (extent.x0 + extent.x1) / 2) / CA);
const INTERIOR: Record<PodId, Layer[]> = { compute: compute(), electrical: electrical(), cooling: cooling() };

const PAD = 10;
export const VIEW: Bounds = {
  x: round(extent.x0 - PAD),
  y: round(extent.y0 - PAD),
  w: round(extent.x1 - extent.x0 + 2 * PAD),
  h: round(extent.y1 - extent.y0 + 2 * PAD),
};

const LAYERS: Record<PodId, Layer[]> = {
  compute: [SHELL_BACK, ...INTERIOR.compute, ...SHELL_FRONT],
  electrical: [SHELL_BACK, ...INTERIOR.electrical, ...SHELL_FRONT],
  cooling: [SHELL_BACK, ...INTERIOR.cooling, ...SHELL_FRONT],
};

const fraction = ([sx, sy]: [number, number]) => ({ x: (sx - VIEW.x) / VIEW.w, y: (sy - VIEW.y) / VIEW.h });

/** Where the fiber leaves the pod, as fractions of the drawing's width and height. */
export const DROP = fraction(view([HW, DROP_Y, 0]));

const ANCHOR_POINTS: Record<string, P3> = {
  roof: [27, -50, RIDGE - SLOPE * 27],
  facade: [HW, -90, (GLASS + EAVE) / 2],
  noc: [-20, 89, BASE + 26],
  deck: [10, HL + 30, 2],
  "fiber-a": [HW, DROP_Y + 4, 0],
  "fiber-b": [HW, DROP_Y - 4, 0],
  racks: [-16, rackY(1) + 6, 28],
  spine: [-16, rackY(5), 34],
  coolant: [-16, -110, 28],
  transformer: [-9, -91, 28],
  fans: [30, -HL, 22],
  switchboard: [-22, -32, 30],
  ups: [-22, 16, 28],
  tanks: [-19, -47, 28],
  pumps: [-25, -20, 20],
  hx: [-26, 26, 26],
  headers: [2, 10, BASE + 6],
};

/** Hotspot marker positions as fractions of the drawing's width and height. */
export const ANCHORS: Record<string, { x: number; y: number }> = Object.fromEntries(
  Object.entries(ANCHOR_POINTS).map(([id, p]) => [id, fraction(view(p))]),
);

export interface CabinArtProps {
  pod: PodId;
  active: string | null;
  onActive: (zone: string | null) => void;
}

/**
 * Zone of the part under a screen point. Solid parts win, even when seen
 * through glazing; over bare glass, the deepest pane's zone answers.
 */
function zoneAt(svg: SVGSVGElement, x: number, y: number): string | null {
  let glass: string | null = null;
  for (const el of document.elementsFromPoint(x, y)) {
    if (!(el instanceof SVGGeometryElement) || !svg.contains(el)) continue;
    const zone = el.closest<SVGGElement>("[data-zone]")?.dataset.zone;
    if (!zone) continue;
    if (!el.classList.contains(styles.glass)) return zone;
    glass = zone;
  }
  return glass;
}

/** The cabin drawing; hovering any hotspot layer reports its zone, or on touch, tapping toggles it. */
export function CabinArt({ pod, active, onActive }: CabinArtProps): ReactElement {
  return (
    <svg
      className={styles.art}
      viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
      aria-hidden="true"
      onPointerMove={(event) => {
        if (event.pointerType !== "mouse") return;
        onActive(zoneAt(event.currentTarget, event.clientX, event.clientY));
      }}
      onPointerLeave={(event) => event.pointerType === "mouse" && onActive(null)}
      onPointerUp={(event) => {
        if (event.pointerType === "mouse") return;
        const zone = zoneAt(event.currentTarget, event.clientX, event.clientY);
        onActive(zone === active ? null : zone);
      }}
    >
      {LAYERS[pod].map((l) => (
        <g
          key={l.key}
          className={l.interior ? `${styles.layer} ${styles.enter}` : styles.layer}
          data-zone={l.zone}
          data-on={(l.zone !== undefined && l.zone === active) || undefined}
        >
          {l.items}
        </g>
      ))}
    </svg>
  );
}
