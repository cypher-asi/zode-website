import type { ReactElement } from "react";
import { Sketch, round, type Bounds, type P3 } from "./lineArt";
import type { PodId } from "./podTour";
import styles from "./lineArt.module.css";

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
  /** Only drawn with the roof on ("hide") or only in the cutaway view ("show"). */
  cutaway?: "hide" | "show";
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

function layer(
  key: string,
  zone: string | undefined,
  draw: (s: Sketch) => void,
  interior = false,
  cutaway?: Layer["cutaway"],
): Layer {
  const s = new Sketch(styles, view);
  draw(s);
  const b = s.bounds();
  if (Number.isFinite(b.w)) {
    grow(b.x, b.y);
    grow(b.x + b.w, b.y + b.h);
  }
  return { key, zone, interior, cutaway, items: s.items };
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
// Pipes
// ---------------------------------------------------------------------------

type S2 = readonly [number, number];

/** Elbow radius, in pipe radii. */
const BEND = 2.5;

const towards = (p: V3, q: V3): V3 => {
  const d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]] as const;
  const n = Math.hypot(...d);
  return [d[0] / n, d[1] / n, d[2] / n];
};

const mix = (o: V3, a: V3, ka: number, b: V3, kb: number): V3 => [
  o[0] + a[0] * ka + b[0] * kb,
  o[1] + a[1] * ka + b[1] * kb,
  o[2] + a[2] * ka + b[2] * kb,
];

const axisOf = (d: V3): Axis => (["x", "y", "z"] as const)[d.findIndex((c) => Math.abs(c) > 0.5)];

/** Screen direction of a model direction. */
const aim = ([x, y, z]: V3): S2 => [x * SA - y * CA, (x * CA + y * SA) * SE - z * CE];

/** Where segments `ab` and `cd` cross, if they do. */
function crossing(a: S2, b: S2, c: S2, d: S2): S2 | null {
  const den = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / den;
  const u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / den;
  return t > 0 && t < 1 && u > 0 && u < 1 ? [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])] : null;
}

/** An offset outline with the loops a foreshortened bend folds into it cut out at their crossings. */
function unfold(line: S2[]): S2[] {
  const out = line.slice();
  for (let i = 0; i < out.length - 2; i++) {
    for (let j = out.length - 2; j > i + 1; j--) {
      const x = crossing(out[i], out[i + 1], out[j], out[j + 1]);
      if (x) {
        out.splice(i + 1, j - i, x);
        break;
      }
    }
  }
  return out;
}

/**
 * Pipe along an axis-aligned `route`, each corner bent round an elbow. The
 * projection is orthographic at unit scale, so the tube's silhouette is its
 * projected centreline offset by `r` either side, closed by the visible half
 * of each end. `flanges` puts a flange on the first and last ends.
 */
function pipe(
  s: Sketch,
  route: readonly V3[],
  r: number,
  body = styles.sideR,
  flanges: readonly [boolean, boolean] = [true, true],
): void {
  const n = route.length;
  const bend = r * BEND;
  const centre: { p: V3; t: V3 }[] = [{ p: route[0], t: towards(route[0], route[1]) }];
  const seams: { p: V3; axis: Axis }[] = [];
  for (let i = 1; i < n - 1; i++) {
    const [b, u, v] = [route[i], towards(route[i], route[i - 1]), towards(route[i], route[i + 1])];
    for (let k = 0; k <= 12; k++) {
      const q = (Math.PI / 2) * (k / 12);
      centre.push({
        p: mix(b, u, bend * (1 - Math.sin(q)), v, bend * (1 - Math.cos(q))),
        t: mix([0, 0, 0], u, -Math.cos(q), v, Math.sin(q)),
      });
    }
    // From this low camera a level bend is seen nearly edge on, and its seams would pile up into a curl.
    if (axisOf(u) === "z" || axisOf(v) === "z") {
      seams.push({ p: mix(b, u, bend, v, 0), axis: axisOf(u) }, { p: mix(b, u, 0, v, bend), axis: axisOf(v) });
    }
  }
  centre.push({ p: route[n - 1], t: towards(route[n - 2], route[n - 1]) });

  const left: S2[] = [];
  const right: S2[] = [];
  for (const { p, t } of centre) {
    const [cx, cy] = view(p);
    const [dx, dy] = aim(t);
    const k = r / Math.hypot(dx, dy);
    left.push([cx - dy * k, cy + dx * k]);
    right.push([cx + dy * k, cy - dx * k]);
  }

  /** Half of an end's rim facing away from the tube, starting next to `from`. */
  const cap = (end: V3, inward: V3, from: S2): S2[] => {
    const axis = axisOf(inward);
    const t = facing(axis);
    const [ex, ey] = view(end);
    const [ix, iy] = aim(inward);
    const halves = [t - Math.PI / 2, t + Math.PI / 2].map((a) => arc(end, axis, r, a, a + Math.PI, 12).map(view));
    const rim = halves.find((h) => (h[6][0] - ex) * ix + (h[6][1] - ey) * iy < 0) ?? halves[0];
    const gap = (q: S2) => Math.hypot(q[0] - from[0], q[1] - from[1]);
    return gap(rim[0]) <= gap(rim[rim.length - 1]) ? rim : rim.reverse();
  };

  const [l, rr] = [unfold(left), unfold(right).reverse()];
  const [first, last] = [centre[0], centre[centre.length - 1]];
  const outline = [
    ...l,
    ...cap(last.p, [-last.t[0], -last.t[1], -last.t[2]], l[l.length - 1]),
    ...rr,
    ...cap(first.p, first.t, rr[rr.length - 1]),
  ];

  const ends = [
    { p: route[0], inward: towards(route[0], route[1]) },
    { p: route[n - 1], inward: towards(route[n - 1], route[n - 2]) },
  ];
  /** A flange the pipe runs toward the viewer from sits behind it; one it runs away into, in front. */
  const flange = (front: boolean) =>
    ends.forEach(({ p, inward }, k) => {
      if (flanges[k] && dot(inward, EYE) > 0 !== front) circle(s, p, axisOf(inward), r + 0.7, styles.top);
    });

  flange(false);
  for (const [x, y] of outline) s.extend(x, y);
  s.path(`M${outline.map(([x, y]) => `${round(x)} ${round(y)}`).join("L")}Z`, body);
  for (const { p, axis } of seams) hoop(s, p, axis, r, 0);
  flange(true);
}

/** Near half of the collar where a pipe of radius `r` passes into a surface, painted over the pipe's foot. */
function sleeve(s: Sketch, c: P3, axis: Axis, r: number, collar: number): void {
  const t = facing(axis);
  s.face(
    [...arc(c, axis, collar, t - Math.PI / 2, t + Math.PI / 2), ...arc(c, axis, r, t - Math.PI / 2, t + Math.PI / 2).reverse()],
    styles.top,
  );
}

/** Steel stand under a pipe, from `z0` up to its underside at `z1`. */
const stand = (s: Sketch, x: number, y: number, z0: number, z1: number) =>
  s.box(x - 0.8, y - 0.8, 1.6, 1.6, z0, z1 - z0, FRAMED);

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
/** The light panels left once the near slope is cut away, from just past the ridge, where the ceiling starts. */
const ROOF_BACK: P2[] = ROOF.filter(([x]) => x <= 1e-9);
/** A rafter's outer edge, from the bullnose crest up the near slope to the cut. */
const RAFTER: P2[] = [...OUTER.right.slice(NOSE), ...OUTER.apex.slice(0, OUTER.apex.indexOf(ROOF_BACK[0]) + 1)];

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

/** Panel seams along the roof, each over a rafter. */
const SEAMS = [-HL / 3, HL / 3];

/** Roof that stays in the cutaway: the far slope's crown and the cut along the ridge. */
function roof(s: Sketch): void {
  extrude(s, ROOF_BACK, -HL, HL, styles.roof);
  for (const y of SEAMS) s.line(ROOF_BACK.map(at(y)), styles.edge);
  const [x, z] = ROOF_BACK[0];
  rectX(s, x, -HL, HL, z - ROOF_T, z, styles.band);
}

/** The near slope's rafters under the panel seams, only seen with the skin off. */
function rafters(s: Sketch): void {
  const w = 0.8;
  const under = RAFTER.map(([x, z]): P2 => [x, z - ROOF_T]).reverse();
  for (const y of SEAMS) {
    s.face([...RAFTER, ...under].map(at(y + w)), styles.frame);
    extrude(s, RAFTER, y - w, y + w, styles.frame);
  }
}

/** The near roof slope, lifted off in the cutaway view. */
function roofNear(s: Sketch): void {
  extrude(s, EAVE_BAND, -HL, HL, styles.band);
  extrude(s, ROOF, -HL, HL, styles.roof);
  for (const y of SEAMS) s.line(ROOF.map(at(y)), styles.edge);
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

/*
 * Overhead services, all hung from trapezes every two racks: the A and B
 * busways high over the rack rears, clear of the water, and the supply and
 * return coolant headers lower over the fronts. Lanes run far to near, each
 * stepping down toward the viewer so that from this low camera every lane
 * clears the one in front of it and the facade's fascia.
 */
const RACK_TOP = BASE + RACK.height;
const RACK_MID = (i: number) => rackY(i) + RACK.width / 2;
const RUN_END = rackY(9) + RACK.width + 2;
const BUSWAYS = [
  { x: -41, z: BASE + 55.5 },
  { x: -35.5, z: BASE + 52.5 },
];
const BUSWAY = { w: 3, h: 2.4, y0: rackY(0) - 4 };
const TAP = { w: 2.2, d: 3.6, h: 3 };
const HEADERS = [
  { x: -26, z: BASE + 52 },
  { x: -20.5, z: BASE + 49.5 },
];
const HEADER = { r: 1.6, y0: -110 };
const TRAPEZE = { x0: -45, x1: -16, z: BASE + 59, t: 1.2, at: [0, 2, 4, 6, 8, 10].map((i) => rackY(i) - 0.5) };

/*
 * The chilled and warm water pair between the pods, the warm one stacked
 * above so its branches clear the chilled one. In each pod the pair crosses
 * the hall to a service panel at the foot of the glazing, where both pass
 * out, bend down and dive into the ground toward the other pods.
 */
const LOOPS = [
  { x: -4, z: BASE + 6 },
  { x: 2, z: BASE + 12 },
] as const;
const LOOP = { r: 2.4, branch: 1.6 };
/** Where the pair leaves each pod, along the glazed side. */
const EXIT = { compute: -107, cooling: 30 };
const PANEL = { half: 5.5, top: BASE + 18 };
/** How far out past the facade each pipe of the pair turns down into the ground. */
const REACH = [5.5, 11.5];

const loopBody = (k: number) => (k ? styles.sideL : styles.sideR);
/** Stand under the pair's `k`th pipe where the two run stacked: the warm one rests on the chilled one. */
const stackedStand = (s: Sketch, k: number, x: number, y: number) =>
  stand(s, x, y, k ? LOOPS[0].z + LOOP.r : BASE, LOOPS[k].z - LOOP.r);

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
        LOOPS.forEach(({ z }, k) => {
          for (const sx of [8, 32]) stackedStand(s, k, sx, EXIT.compute);
          pipe(s, [[x + w, EXIT.compute, z], [GX, EXIT.compute, z]], LOOP.r, loopBody(k), [true, false]);
        });
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
      "compute-busways",
      "busways",
      (s) => {
        for (const { x, z } of BUSWAYS) {
          for (let i = 0; i < 10; i++) {
            const y = RACK_MID(i);
            s.line([[x, y, RACK_TOP], [x, y, z - TAP.h]], styles.edge);
            s.box(x - TAP.w / 2, y - TAP.d / 2, TAP.w, TAP.d, z - TAP.h, TAP.h);
          }
          s.box(x - BUSWAY.w / 2, BUSWAY.y0, BUSWAY.w, RUN_END - BUSWAY.y0, z, BUSWAY.h);
          for (const y of TRAPEZE.at) s.line([[x, y, z + BUSWAY.h], [x, y, TRAPEZE.z]]);
        }
      },
      true,
    ),
    layer(
      "compute-headers",
      "coolant",
      (s) => {
        const end = RACK_MID(9);
        HEADERS.forEach(({ x, z }, k) => {
          for (let i = 0; i < 9; i++) s.line([[x, RACK_MID(i), RACK_TOP], [x, RACK_MID(i), z]], styles.edge);
          for (const y of TRAPEZE.at) if (y < end) s.line([[x, y, z + HEADER.r], [x, y, TRAPEZE.z]]);
          const route: V3[] = [
            [x, HEADER.y0, BASE + 38],
            [x, HEADER.y0, z],
            [x, end, z],
            [x, end, RACK_TOP],
          ];
          pipe(s, route, HEADER.r, loopBody(k));
        });
      },
      true,
    ),
    layer(
      "compute-trapezes",
      undefined,
      (s) => {
        for (const y of TRAPEZE.at) {
          for (const x of [TRAPEZE.x0 + 1, TRAPEZE.x1 - 1]) {
            s.line([[x, y, TRAPEZE.z + TRAPEZE.t], [x, y, ceilingAt(x)]], styles.hair);
          }
          s.box(TRAPEZE.x0, y - TRAPEZE.t / 2, TRAPEZE.x1 - TRAPEZE.x0, TRAPEZE.t, TRAPEZE.z, TRAPEZE.t);
        }
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
    ...runs("cooling", 30, [16, -104]),
    layer(
      "cooling-headers",
      "headers",
      (s) => {
        // Branches as [y, x] of the equipment face they run into: the pump casings
        // and exchanger on the chilled header, the second tank and exchanger on the warm.
        const taps: [number, number][][] = [
          [[-33, -20.5], [-21, -20.5], [-5, -20.5], [7, -20.5], [22, -26]],
          [[-60, -15], [22, -26]],
        ];
        const [tank, exit] = [-98, EXIT.cooling];
        LOOPS.forEach(({ x, z }, k) => {
          const body = loopBody(k);
          for (const y of [-80, -45, -13, 12]) stand(s, x, y, BASE, z - LOOP.r);
          for (const sx of [20, 42]) stackedStand(s, k, sx, exit);
          for (const [y, tx] of taps[k]) pipe(s, [[tx, y, z], [x, y, z]], LOOP.branch, body, [true, false]);
          const route: V3[] = [
            [-15, tank, z],
            [x, tank, z],
            [x, exit, z],
            [GX, exit, z],
          ];
          pipe(s, route, LOOP.r, body, [true, false]);
        });
      },
      true,
    ),
  ];
}

/** A pod's coolant pair passing out through a service panel at the foot of the glazing and bending down into the ground. */
function outfall(pod: PodId, zone: string, y: number): Layer {
  return layer(
    `${pod}-outfall`,
    zone,
    (s) => {
      const x0 = GX + 0.3;
      rectX(s, x0, y - PANEL.half, y + PANEL.half, BASE, PANEL.top, styles.frame);
      LOOPS.forEach(({ z }, k) => {
        const x = HW + REACH[k];
        pipe(s, [[x0, y, z], [x, y, z], [x, y, 0]], LOOP.r, loopBody(k));
        sleeve(s, [x, y, 0], "z", LOOP.r, LOOP.r + 0.7);
      });
    },
    true,
  );
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

const SHELL_BACK = layer("shell-back", undefined, back);
const SHELL_FRONT = [
  layer("noc", "noc", noc),
  layer("facade", "facade", facade),
  layer("roof", "roof", roof),
  layer("rafters", "roof", rafters, false, "show"),
  layer("roof-near", "roof", roofNear, false, "hide"),
  layer("deck", "deck", deck),
];
/** Along the glazed side, where its foot sits below the drawing's middle; the equipment all stays inside the shell's extent. */
const DROP_Y = round((HW * SA - (extent.x0 + extent.x1) / 2) / CA);
const INTERIOR: Record<PodId, Layer[]> = { compute: compute(), electrical: electrical(), cooling: cooling() };
/** Pod parts outside the glazing, painted over the shell. */
const EXTERIOR = {
  compute: outfall("compute", "coolant", EXIT.compute),
  cooling: outfall("cooling", "headers", EXIT.cooling),
};

const PAD = 10;
export const VIEW: Bounds = {
  x: round(extent.x0 - PAD),
  y: round(extent.y0 - PAD),
  w: round(extent.x1 - extent.x0 + 2 * PAD),
  h: round(extent.y1 - extent.y0 + 2 * PAD),
};

const LAYERS: Record<PodId, Layer[]> = {
  compute: [SHELL_BACK, ...INTERIOR.compute, ...SHELL_FRONT, EXTERIOR.compute],
  electrical: [SHELL_BACK, ...INTERIOR.electrical, ...SHELL_FRONT],
  cooling: [SHELL_BACK, ...INTERIOR.cooling, ...SHELL_FRONT, EXTERIOR.cooling],
};

const fraction = ([sx, sy]: [number, number]) => ({ x: (sx - VIEW.x) / VIEW.w, y: (sy - VIEW.y) / VIEW.h });

/** Where the fiber leaves the pod, as fractions of the drawing's width and height. */
export const DROP = fraction(view([HW, DROP_Y, 0]));

const ANCHOR_POINTS: Record<string, P3> = {
  roof: at(80)(ROOF_BACK[Math.floor(ROOF_BACK.length / 2)]),
  facade: [HW, -90, (GLASS + EAVE) / 2],
  noc: [-20, 89, BASE + 26],
  deck: [10, HL + 30, 2],
  "fiber-a": [HW, DROP_Y + 4, 0],
  "fiber-b": [HW, DROP_Y - 4, 0],
  racks: [-16, rackY(1) + 6, 28],
  spine: [-16, rackY(5), 34],
  coolant: [-16, -110, 28],
  busways: [BUSWAYS[1].x, RACK_MID(8), BUSWAYS[1].z + BUSWAY.h],
  transformer: [-9, -91, 28],
  fans: [30, -HL, 22],
  switchboard: [-22, -32, 30],
  ups: [-22, 16, 28],
  tanks: [-19, -47, 28],
  pumps: [-25, -20, 20],
  hx: [-26, 26, 26],
  headers: [LOOPS[1].x, 10, LOOPS[1].z],
};

/** Hotspot marker positions as fractions of the drawing's width and height. */
export const ANCHORS: Record<string, { x: number; y: number }> = Object.fromEntries(
  Object.entries(ANCHOR_POINTS).map(([id, p]) => [id, fraction(view(p))]),
);

export interface CabinArtProps {
  pod: PodId;
  /** Lifts the near roof slope off to show the overhead services. */
  cutaway?: boolean;
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
export function CabinArt({ pod, cutaway = false, active, onActive }: CabinArtProps): ReactElement {
  return (
    <svg
      className={styles.art}
      viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
      aria-hidden="true"
      data-cut={cutaway || undefined}
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
          data-cutaway={l.cutaway}
          data-on={(l.zone !== undefined && l.zone === active) || undefined}
        >
          {l.items}
        </g>
      ))}
    </svg>
  );
}
