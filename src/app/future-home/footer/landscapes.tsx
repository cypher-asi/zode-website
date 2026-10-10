import type { ReactElement } from "react";
import { Sketch, rng, round } from "../lineart";
import styles from "./FooterScene.module.css";

/**
 * Footer panorama: six flat, side-on landscapes that share one ground line,
 * plus a single dimetric ZODE drawn once and laid over whichever is showing.
 * Every landscape keeps its foreground clear under the ZODE's pad, so the
 * cabin always reads as standing on level ground in the same spot.
 */

export const VIEW = { w: 1600, h: 500 } as const;

/** Where the landscapes meet the ground plane; far scenery stands on it. */
const HORIZON = 290;

/** ZODE dimensions in its local dimetric units. */
const Z = { w: 70, l: 210, base: 4, eave: 56, ridge: 90, deck: 44, bay: 30 } as const;

/** Concrete pad under the ZODE, in local ground units. */
const PAD = { x0: -12, x1: Z.w + 14, y0: -10, y1: Z.l + Z.deck + 10 } as const;

/** Screen position of the ZODE's back plinth corner (its local origin), and its scale. */
const ZODE_AT = [1195, 290] as const;
const ZODE_SCALE = 1.15;

/** Horizontal band the ZODE covers on screen. */
const KEEP = [870, 1310] as const;

const clear = (x: number, pad = 0) => x < KEEP[0] - pad || x > KEEP[1] + pad;

/** Screen point to ZODE-local ground coordinates (`project` inverted at z = 0). */
function local(x: number, y: number): [number, number] {
  const sx = (x - ZODE_AT[0]) / ZODE_SCALE;
  const sy = (y - ZODE_AT[1]) / ZODE_SCALE;
  return [sy + sx / 2, sy - sx / 2];
}

/** Whether a flat mark at (x, y) would land on the pad, give or take `m` local units. */
function onPad(x: number, y: number, m = 6): boolean {
  const [X, Y] = local(x, y);
  return X > PAD.x0 - m && X < PAD.x1 + m && Y > PAD.y0 - m && Y < PAD.y1 + m;
}

/**
 * Whether something standing at (x, y) can be painted beneath the ZODE layer:
 * either it's off to the side, or it's behind the cabin and so correctly hidden by it.
 */
function canStand(x: number, y: number, pad = 20): boolean {
  if (clear(x, pad)) return true;
  const [X, Y] = local(x, y);
  return (X < PAD.x0 - 4 || Y < PAD.y0 - 4) && X < PAD.x1 && Y < PAD.y1;
}

/** Screen-x interval the pad covers along row y, if any. */
function padSpan(y: number): [number, number] | null {
  const dy = (y - ZODE_AT[1]) / ZODE_SCALE;
  const lo = Math.max(2 * (PAD.x0 - dy), 2 * (dy - PAD.y1));
  const hi = Math.min(2 * (PAD.x1 - dy), 2 * (dy - PAD.y0));
  return lo < hi ? [ZODE_AT[0] + lo * ZODE_SCALE, ZODE_AT[0] + hi * ZODE_SCALE] : null;
}

type Pt = readonly [number, number];

const pts = (ps: readonly Pt[]) => ps.map(([x, y]) => `${round(x)},${round(y)}`).join(" ");

function poly(s: Sketch, ps: readonly Pt[], className: string): void {
  s.el("polygon", { points: pts(ps), className });
}

function pline(s: Sketch, ps: readonly Pt[], className: string = styles.fine): void {
  s.el("polyline", { points: pts(ps), className });
}

function rect(s: Sketch, x: number, y: number, w: number, h: number, className: string): void {
  s.el("rect", { x: round(x), y: round(y), width: round(w), height: round(h), className });
}

function circle(s: Sketch, cx: number, cy: number, r: number, className: string): void {
  s.el("circle", { cx: round(cx), cy: round(cy), r: round(r), className });
}

function seg(s: Sketch, x1: number, y1: number, x2: number, y2: number, className: string = styles.fine): void {
  s.el("line", { x1: round(x1), y1: round(y1), x2: round(x2), y2: round(y2), className });
}

/** A horizontal line across the view that stops at the edges of the ZODE's pad. */
function spans(s: Sketch, y: number, className: string): void {
  const gap = padSpan(y);
  if (!gap) return seg(s, -20, y, VIEW.w + 20, y, className);
  seg(s, -20, y, gap[0] - 3, y, className);
  seg(s, gap[1] + 3, y, VIEW.w + 20, y, className);
}

/** Filled silhouette under `f(x)` down past the bottom edge, so nearer layers occlude farther ones. */
function ground(s: Sketch, f: (x: number) => number, className: string, step = 10): void {
  const top: Pt[] = [];
  for (let x = -20; x <= VIEW.w + 20; x += step) top.push([x, f(x)]);
  poly(s, [[-20, VIEW.h + 20], ...top, [VIEW.w + 20, VIEW.h + 20]], className);
}

/** Linear interpolation along a polyline sorted by x. */
function along(ps: readonly Pt[], x: number): number {
  for (let i = 1; i < ps.length; i++) {
    const [x0, y0] = ps[i - 1];
    const [x1, y1] = ps[i];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
  }
  return ps[ps.length - 1][1];
}

/** Jagged range alternating saddles and summits; odd indices are summits. */
function ridge(r: () => number, summit: Pt, saddle: Pt, spacing: Pt): Pt[] {
  const out: Pt[] = [];
  let x = -40;
  for (let k = 0; x < VIEW.w + 40; k++) {
    const [a, b] = k % 2 ? summit : saddle;
    out.push([x, a + r() * (b - a)]);
    x += spacing[0] + r() * (spacing[1] - spacing[0]);
  }
  return out;
}

function range(s: Sketch, ps: readonly Pt[], className: string): void {
  poly(s, [[ps[0][0], VIEW.h + 20], ...ps, [ps[ps.length - 1][0], VIEW.h + 20]], className);
}

/** Scalloped cloud resting on a flat base at (x, y). */
function cloud(s: Sketch, x: number, y: number, w: number): void {
  const bumps = [0.22, 0.32, 0.26, 0.2];
  const d = bumps.map((b) => `a${round((w * b) / 2)},${round((w * b) / 2.4)} 0 0 1 ${round(w * b)},0`).join(" ");
  s.path(`M${round(x)},${round(y)} ${d} Z`, styles.cloud);
}

function birds(s: Sketch, flock: readonly Pt[]): void {
  s.path(flock.map(([x, y]) => `M${x},${y} q4,-4 8,0 q4,-4 8,0`).join(""), styles.fine);
}

/** Lumpy closed outline for tree canopies and scrub. */
function blob(s: Sketch, cx: number, cy: number, rx: number, ry: number, phase: number, className: string): void {
  const ps: Pt[] = [];
  for (let k = 0; k < 48; k++) {
    const t = (k / 48) * Math.PI * 2;
    const f = 1 + 0.09 * Math.sin(6 * t + phase) + 0.05 * Math.sin(11 * t + phase * 2);
    ps.push([cx + rx * f * Math.cos(t), cy + ry * f * Math.sin(t)]);
  }
  poly(s, ps, className);
}

function tufts(s: Sketch, r: () => number, count: number, top: number): void {
  let d = "";
  for (let k = 0; k < count; k++) {
    const x = r() * VIEW.w;
    const y = top + r() * (VIEW.h - top);
    if (onPad(x, y, 10)) continue;
    const k2 = 0.6 + ((y - HORIZON) / (VIEW.h - HORIZON)) * 0.9;
    const [a, b, c] = [3 * k2, 9 * k2, 7 * k2];
    d += `M${round(x)},${round(y)}l${round(-a)},${round(-c)}M${round(x)},${round(y)}l0,${round(-b)}M${round(x)},${round(y)}l${round(a)},${round(-c)}`;
  }
  s.path(d, styles.fine);
}

function pine(s: Sketch, x: number, y: number, h: number, className: string = styles.top): void {
  seg(s, x, y, x, y - h * 0.16, styles.edge);
  for (let t = 0; t < 3; t++) {
    const base = y - h * 0.14 - t * h * 0.24;
    const w = h * (0.44 - t * 0.1);
    poly(
      s,
      [
        [x - w / 2, base],
        [x, base - h * 0.42],
        [x + w / 2, base],
      ],
      className,
    );
  }
}

// ---------------------------------------------------------------------------
// The ZODE: gabled glass cabin with an entrance deck, drawn in the page's
// 2:1 dimetric projection. Long axis runs along +y toward the front-left
// gable; the glazed long side faces +x.
// ---------------------------------------------------------------------------

function zode(s: Sketch): void {
  const { w: W, l: L, base: B, eave: H, ridge: R, deck: D, bay } = Z;
  const roofZ = (x: number) => H + (R - H) * (1 - Math.abs(x - W / 2) / (W / 2));

  s.face(
    [
      [PAD.x0, PAD.y0, 0],
      [PAD.x1, PAD.y0, 0],
      [PAD.x1, PAD.y1, 0],
      [PAD.x0, PAD.y1, 0],
    ],
    styles.pad,
  );
  s.box(-1, -1, W + 2, L + 2, 0, B);

  s.face(
    [
      [W, 0, B],
      [W, L, B],
      [W, L, H],
      [W, 0, H],
    ],
    styles.glass,
  );
  // Rack rows seen through the glass, set back from the wall plane.
  for (let y = 66; y < L - 40; y += 28) {
    s.face(
      [
        [W - 16, y, B],
        [W - 16, y + 24, B],
        [W - 16, y + 24, B + 36],
        [W - 16, y, B + 36],
      ],
      styles.rack,
    );
    for (let v = y + 4; v < y + 24; v += 4) s.line([[W - 16, v, B + 3], [W - 16, v, B + 33]], styles.rackLine);
  }
  for (let y = 0; y < L; y += bay) s.line([[W, y + 6, H - 6], [W, y + 15, H - 24]], styles.glint);
  for (let y = 0; y <= L; y += bay) s.line([[W, y, B], [W, y, H]], styles.frame);
  s.line([[W, 0, B], [W, L, B]], styles.frame);
  s.line([[W, 0, H], [W, L, H]], styles.frame);

  const gable: [number, number, number][] = [
    [0, L, B],
    [W, L, B],
    [W, L, H],
    [W / 2, L, R],
    [0, L, H],
  ];
  s.face(gable, styles.glass);
  s.line([[W * 0.62, L, H + 10], [W * 0.78, L, H - 14]], styles.glint);
  for (const x of [W / 3, (2 * W) / 3]) s.line([[x, L, B], [x, L, roofZ(x)]], styles.frame);
  s.line([[0, L, H], [W, L, H]], styles.frame);
  s.line([[W / 3, L, H - 6], [(2 * W) / 3, L, H - 6]], styles.frame);
  s.line([[W / 2 + 4, L, 24], [W / 2 + 4, L, 32]], styles.edge);
  s.face(gable, styles.frameFace);

  const o = 4;
  for (const side of [0, W]) {
    const out = side === 0 ? -o : W + o;
    s.face(
      [
        [out, -o, H - 2],
        [W / 2, -o, R + 2],
        [W / 2, L + o, R + 2],
        [out, L + o, H - 2],
      ],
      styles.roof,
    );
  }
  for (let y = 8; y < L; y += 14) s.line([[W + o, y, H - 2], [W / 2, y, R + 2]], styles.seam);
  for (const out of [-o, W + o]) {
    s.face(
      [
        [out, L + o, H - 2],
        [W / 2, L + o, R + 2],
        [W / 2, L + o, R - 4],
        [out, L + o, H - 8],
      ],
      styles.fascia,
    );
  }

  s.box(-4, L, W + 8, D, 0, 6);
  for (let y = L + 5; y < L + D; y += 5) s.line([[-4, y, 6], [W + 4, y, 6]]);
  const rail = (ps: [number, number, number][]) => {
    s.face(ps, styles.rail);
    s.line([ps[3], ps[2]], styles.frame);
  };
  rail([
    [-4, L, 6],
    [-4, L + D, 6],
    [-4, L + D, 28],
    [-4, L, 28],
  ]);
  rail([
    [-4, L + D, 6],
    [W + 4, L + D, 6],
    [W + 4, L + D, 28],
    [-4, L + D, 28],
  ]);
  rail([
    [W + 4, L + D, 6],
    [W + 4, L, 6],
    [W + 4, L, 28],
    [W + 4, L + D, 28],
  ]);
}

// ---------------------------------------------------------------------------
// Landscapes
// ---------------------------------------------------------------------------

function tower(s: Sketch, r: () => number, x: number, w: number, h: number): void {
  const top = HORIZON - h;
  if (r() < 0.35) rect(s, x + w * 0.2, top - 20, w * 0.6, 20, styles.top);
  if (h > 190) seg(s, x + w / 2, top - 20, x + w / 2, top - 58, styles.edge);
  rect(s, x, top, w, h, styles.top);

  const kind = Math.floor(r() * 3);
  let d = "";
  if (kind !== 1) {
    for (let y = top + 10; y < HORIZON - 6; y += 9) d += `M${round(x + 5)},${round(y)}H${round(x + w - 5)}`;
  }
  if (kind !== 0) {
    const cols = Math.max(2, Math.round((w - 10) / 8));
    for (let c = 1; c < cols; c++) {
      const cx = round(x + 5 + ((w - 10) * c) / cols);
      d += `M${cx},${round(top + 6)}V${HORIZON - 6}`;
    }
  }
  s.path(d, styles.faint);
}

function car(s: Sketch, x: number, y: number): void {
  s.path(
    `M${x},${y - 6}V${y - 16}Q${x},${y - 20} ${x + 4},${y - 20}H${x + 14}L${x + 22},${y - 30}H${x + 46}L${x + 56},${y - 20}H${x + 66}Q${x + 70},${y - 20} ${x + 70},${y - 16}V${y - 6}Z`,
    styles.top,
  );
  s.path(`M${x + 24},${y - 21}L${x + 28},${y - 27}H${x + 38}V${y - 21}Z`, styles.sideR);
  s.path(`M${x + 41},${y - 21}V${y - 27}H${x + 45}L${x + 51},${y - 21}Z`, styles.sideR);
  for (const wx of [x + 16, x + 54]) {
    circle(s, wx, y - 6, 6, styles.ring);
    circle(s, wx, y - 6, 2, styles.ink);
  }
}

function city(s: Sketch): void {
  const r = rng(7);
  cloud(s, 120, 96, 130);
  cloud(s, 1390, 70, 160);

  for (let x = -20; x < VIEW.w + 20; ) {
    const w = 16 + r() * 30;
    const h = 40 + r() * 80;
    rect(s, x, HORIZON - h, w, h, styles.far);
    if (r() < 0.2) seg(s, x + w / 2, HORIZON - h, x + w / 2, HORIZON - h - 14, styles.faint);
    x += w - 2 + r() * 6;
  }

  for (let x = -10; x < VIEW.w + 20; ) {
    const w = 36 + r() * 46;
    tower(s, r, x, w, 70 + r() * 150);
    x += w + 8 + r() * 26;
  }

  // Tower crane over the skyline.
  seg(s, 560, HORIZON, 560, 70, styles.edge);
  seg(s, 566, HORIZON, 566, 70, styles.edge);
  for (let y = HORIZON - 12; y > 74; y -= 12) seg(s, 560, y, 566, y - 12);
  seg(s, 500, 70, 700, 70, styles.edge);
  seg(s, 563, 52, 500, 70, styles.fine);
  seg(s, 563, 52, 700, 70, styles.fine);
  seg(s, 680, 70, 680, 120, styles.fine);
  rect(s, 674, 120, 12, 8, styles.sideR);

  ground(s, () => HORIZON, styles.land);
  spans(s, HORIZON + 12, styles.fine);
  spans(s, HORIZON + 56, styles.fine);
  spans(s, HORIZON + 150, styles.fine);
  let dashes = "";
  for (let x = -10; x < VIEW.w; x += 44) {
    if (!onPad(x, HORIZON + 103) && !onPad(x + 22, HORIZON + 103)) dashes += `M${x},${HORIZON + 103}h22`;
  }
  s.path(dashes, styles.fine);

  const y = HORIZON + 34;
  for (let x = 40; x < VIEW.w; x += 75) {
    if (!canStand(x, y)) continue;
    if (x % 150 === 40) {
      seg(s, x, y, x, y - 64, styles.edge);
      s.path(`M${x},${y - 64}q0,-6 8,-6h6`, styles.edge);
      rect(s, x + 12, y - 71, 9, 3, styles.ink);
    } else {
      seg(s, x, y, x, y - 18, styles.edge);
      blob(s, x, y - 32, 14, 15, x, styles.top);
    }
  }

  car(s, 250, HORIZON + 95);
  car(s, 640, HORIZON + 140);
  car(s, 1440, HORIZON + 95);
}

function turbine(s: Sketch, x: number, base: number, h: number, angle: number): void {
  const hub: Pt = [x, base - h];
  seg(s, x - 1.5, base, x - 0.5, hub[1], styles.edge);
  seg(s, x + 1.5, base, x + 0.5, hub[1], styles.edge);
  for (let k = 0; k < 3; k++) {
    const a = angle + (k * Math.PI * 2) / 3;
    const tip: Pt = [hub[0] + h * 0.46 * Math.cos(a), hub[1] + h * 0.46 * Math.sin(a)];
    const side: Pt = [hub[0] + 5 * Math.cos(a + 0.5), hub[1] + 5 * Math.sin(a + 0.5)];
    poly(s, [hub, side, tip], styles.top);
  }
  circle(s, hub[0], hub[1], 2.5, styles.ring);
}

function oak(s: Sketch, x: number, y: number, size: number): void {
  s.path(
    `M${x - 4},${y}L${x - 3},${y - size * 0.6}M${x + 4},${y}L${x + 3},${y - size * 0.6}M${x},${y - size * 0.55}l${-size * 0.3},${-size * 0.3}M${x},${y - size * 0.6}l${size * 0.28},${-size * 0.34}`,
    styles.edge,
  );
  blob(s, x, y - size * 1.05, size * 0.95, size * 0.62, size, styles.top);
  s.path(`M${x - size * 0.5},${y - size * 0.9}q${size * 0.3},${size * 0.18} ${size * 0.6},0`, styles.faint);
}

function field(s: Sketch): void {
  const r = rng(23);
  cloud(s, 200, 80, 140);
  cloud(s, 760, 120, 100);
  cloud(s, 1300, 64, 170);
  birds(s, [
    [640, 70],
    [664, 82],
    [690, 66],
  ]);

  const far = (x: number) => HORIZON - 70 - 26 * Math.sin(x / 230 + 0.6) - 12 * Math.sin(x / 97 + 2);
  ground(s, far, styles.far);
  turbine(s, 170, far(170) + 4, 110, 0.3);
  turbine(s, 420, far(420) + 4, 88, 1.2);
  turbine(s, 1470, far(1470) + 4, 120, 0.7);

  const mid = (x: number) => HORIZON - 26 - 16 * Math.sin(x / 310 + 2.2) - 6 * Math.sin(x / 120);
  ground(s, mid, styles.land);
  oak(s, 330, mid(330) + 2, 44);
  oak(s, 1450, mid(1450) + 2, 36);
  for (const [x, w] of [
    [560, 14],
    [596, 12],
  ] as const) {
    const y = mid(x) + 1;
    rect(s, x - w / 2, y - 10, w, 10, styles.sideL);
    seg(s, x - w / 2, y - 5, x + w / 2, y - 5, styles.faint);
  }

  ground(s, (x) => HORIZON + 4 + 3 * Math.sin(x / 200), styles.land);

  const fy = HORIZON + 40;
  let prev: number | null = null;
  for (let x = 0; x <= VIEW.w; x += 36) {
    if (!canStand(x, fy, 16)) {
      prev = null;
      continue;
    }
    seg(s, x, fy, x, fy - 22, styles.edge);
    if (prev !== null) {
      seg(s, prev, fy - 17, x, fy - 17);
      seg(s, prev, fy - 8, x, fy - 8);
    }
    prev = x;
  }

  tufts(s, r, 260, HORIZON + 8);
  for (let k = 0; k < 50; k++) {
    const x = r() * VIEW.w;
    const y = HORIZON + 16 + r() * (VIEW.h - HORIZON - 16);
    if (!onPad(x, y, 10)) circle(s, x, y, 1.6, styles.ring);
  }
}

function mountain(s: Sketch): void {
  const r = rng(41);
  birds(s, [
    [380, 60],
    [404, 72],
    [1250, 44],
  ]);

  const far = ridge(r, [60, 130], [170, 210], [70, 130]);
  range(s, far, styles.far);
  for (let i = 1; i < far.length - 1; i += 2) {
    const [[ax, ay], [px, py], [bx, by]] = [far[i - 1], far[i], far[i + 1]];
    const t = 0.3;
    const L: Pt = [px + (ax - px) * t, py + (ay - py) * t];
    const R: Pt = [px + (bx - px) * t * 0.9, py + (by - py) * t * 0.9];
    pline(
      s,
      [L, [L[0] + (R[0] - L[0]) * 0.35, L[1] + 8], [L[0] + (R[0] - L[0]) * 0.65, Math.min(L[1], R[1]) + 2], R],
      styles.faint,
    );
  }

  const mid = ridge(r, [140, 200], [228, 252], [90, 160]);
  range(s, mid, styles.land);
  let hatch = "";
  for (let i = 1; i < mid.length - 1; i += 2) {
    const [[px, py], [bx, by]] = [mid[i], mid[i + 1]];
    for (let k = 1; k < 7; k++) {
      const qx = px + ((bx - px) * k) / 8;
      const qy = py + ((by - py) * k) / 8;
      const len = 10 + r() * 14;
      hatch += `M${round(qx)},${round(qy + 3)}l${round(-len * 0.35)},${round(len)}`;
    }
  }
  s.path(hatch, styles.faint);

  ground(s, (x) => HORIZON - 4 + 6 * Math.sin(x / 180), styles.land);

  const trees: Pt[] = [];
  for (let k = 0; k < 36; k++) trees.push([r() * VIEW.w, HORIZON + r() * 6]);
  for (let k = 0; k < 44; k++) {
    const x = r() * VIEW.w;
    const y = HORIZON + 14 + r() * (VIEW.h - HORIZON - 24);
    if (canStand(x, y, 30)) trees.push([x, y]);
  }
  trees.sort((a, b) => a[1] - b[1]);
  for (const [x, y] of trees) {
    const near = y > HORIZON + 10;
    pine(s, x, y, near ? 34 + (y - HORIZON) * 0.35 + r() * 12 : 14 + r() * 8, near ? styles.top : styles.far);
  }

  for (let k = 0; k < 10; k++) {
    const x = r() * VIEW.w;
    const y = HORIZON + 40 + r() * 160;
    if (onPad(x, y, 14)) continue;
    const w = 10 + r() * 14;
    poly(
      s,
      [
        [x - w / 2, y],
        [x - w / 3, y - w * 0.5],
        [x + w * 0.1, y - w * 0.6],
        [x + w / 2, y],
      ],
      styles.sideR,
    );
  }
}

function saguaro(s: Sketch, x: number, y: number, h: number, arms: readonly (readonly [-1 | 1, number, number])[]): void {
  const tw = 14;
  const aw = 9;
  const reach = 12;
  for (const [side, at, rise] of arms) {
    const xr = x + (side * tw) / 2;
    const yb = y - h * at;
    const xi = xr + side * reach;
    const xo = xi + side * aw;
    const top = yb - h * rise;
    s.path(
      `M${xr},${yb}L${xi},${yb}Q${xo},${yb} ${xo},${yb - aw}L${xo},${top}A${aw / 2},${aw / 2} 0 0 ${side > 0 ? 0 : 1} ${xi},${top}L${xi},${yb - aw}L${xr},${yb - aw}`,
      styles.top,
    );
    seg(s, (xi + xo) / 2, top, (xi + xo) / 2, yb - aw, styles.faint);
  }
  s.path(`M${x - tw / 2},${y}V${y - h + tw / 2}A${tw / 2},${tw / 2} 0 0 1 ${x + tw / 2},${y - h + tw / 2}V${y}`, styles.top);
  for (const dx of [-3, 3]) seg(s, x + dx, y - h + 8, x + dx, y, styles.faint);
}

function mesa(s: Sketch, x: number, w: number, h: number, className: string): void {
  const base = HORIZON - 8;
  poly(
    s,
    [
      [x, base],
      [x + w * 0.1, base - h * 0.8],
      [x + w * 0.16, base - h],
      [x + w * 0.84, base - h],
      [x + w * 0.9, base - h * 0.8],
      [x + w, base],
    ],
    className,
  );
  for (const t of [0.25, 0.45, 0.7]) {
    const y = base - h + h * t;
    const inset = w * (0.1 - t * 0.06) + 4;
    seg(s, x + inset + w * 0.04, y, x + w - inset - w * 0.04, y, styles.faint);
  }
}

function desert(s: Sketch): void {
  const r = rng(59);
  const [sx, sy, sr] = [300, 150, 46];
  circle(s, sx, sy, sr, styles.top);
  for (const dy of [14, 24, 32, 38]) {
    const half = Math.sqrt(sr * sr - dy * dy);
    seg(s, sx - half, sy + dy, sx + half, sy + dy, styles.faint);
  }

  mesa(s, 60, 260, 70, styles.far);
  mesa(s, 700, 180, 96, styles.far);
  mesa(s, 1180, 340, 84, styles.far);

  ground(s, (x) => HORIZON - 14 - 16 * Math.sin(x / 260 + 1) - 6 * Math.sin(x / 90), styles.far);
  mesa(s, 1380, 150, 58, styles.land);
  ground(s, (x) => HORIZON - 2 - 8 * Math.sin(x / 340 + 3), styles.land);

  let ripples = "";
  for (let k = 0; k < 40; k++) {
    const x = r() * VIEW.w;
    const y = HORIZON + 20 + r() * (VIEW.h - HORIZON - 30);
    const w = 20 + ((y - HORIZON) / 210) * 40;
    if (onPad(x, y, 10) || onPad(x + w, y, 10)) continue;
    ripples += `M${round(x)},${round(y)}q${round(w / 2)},-5 ${round(w)},0`;
  }
  s.path(ripples, styles.faint);

  saguaro(s, 220, HORIZON + 120, 120, [
    [1, 0.42, 0.32],
    [-1, 0.58, 0.24],
  ]);
  saguaro(s, 620, HORIZON + 46, 70, [[-1, 0.45, 0.28]]);
  saguaro(s, 1430, HORIZON + 150, 136, [
    [-1, 0.4, 0.3],
    [1, 0.55, 0.26],
  ]);
  saguaro(s, 1560, HORIZON + 60, 64, [[1, 0.5, 0.3]]);

  for (let k = 0; k < 14; k++) {
    const x = r() * VIEW.w;
    const y = HORIZON + 30 + r() * 170;
    if (onPad(x, y, 14)) continue;
    const w = 8 + r() * 12;
    poly(
      s,
      [
        [x - w / 2, y],
        [x - w / 4, y - w * 0.45],
        [x + w / 3, y - w * 0.4],
        [x + w / 2, y],
      ],
      styles.sideR,
    );
  }
}

function lifeguard(s: Sketch, x: number, y: number): void {
  s.path(`M${x - 18},${y}L${x - 12},${y - 42}M${x + 18},${y}L${x + 12},${y - 42}`, styles.edge);
  s.path(`M${x - 16},${y - 14}L${x + 14},${y - 30}M${x + 16},${y - 14}L${x - 14},${y - 30}`, styles.fine);
  s.path(`M${x + 22},${y - 44}L${x + 66},${y}M${x + 22},${y - 50}L${x + 66},${y - 6}`, styles.edge);
  rect(s, x - 24, y - 46, 48, 4, styles.top);
  pline(
    s,
    [
      [x - 24, y - 46],
      [x - 24, y - 58],
      [x + 24, y - 58],
      [x + 24, y - 46],
    ],
    styles.fine,
  );
  rect(s, x - 16, y - 76, 32, 30, styles.top);
  rect(s, x - 10, y - 70, 20, 11, styles.sideR);
  poly(
    s,
    [
      [x - 21, y - 76],
      [x + 21, y - 76],
      [x + 16, y - 85],
      [x - 16, y - 85],
    ],
    styles.sideL,
  );
}

function coast(s: Sketch): void {
  const r = rng(73);
  cloud(s, 260, 90, 150);
  cloud(s, 900, 60, 120);
  birds(s, [
    [520, 120],
    [546, 108],
    [760, 140],
  ]);

  const SEA = 232;
  poly(
    s,
    [
      [840, SEA],
      [880, 222],
      [950, 218],
      [1000, SEA],
    ],
    styles.far,
  );
  seg(s, -20, SEA, 1100, SEA, styles.edge);
  let waves = "";
  for (let k = 0; k < 120; k++) {
    const y = SEA + 6 + Math.pow(r(), 1.4) * 90;
    const x = -20 + r() * 1180;
    const w = 6 + (y - SEA) * 0.32;
    waves += `M${round(x)},${round(y)}q${round(w / 2)},-3 ${round(w)},0`;
  }
  s.path(waves, styles.faint);

  const headland: Pt[] = [
    [1000, 300],
    [1040, SEA],
    [1090, 214],
    [1160, 200],
    [1220, 168],
    [1270, 150],
    [1330, 132],
    [1400, 120],
    [1460, 128],
    [1520, 104],
    [1620, 96],
  ];
  range(s, headland, styles.land);
  let cliff = "";
  for (let x = 1100; x < VIEW.w; x += 13) {
    const y = along(headland, x);
    cliff += `M${x},${round(y + 4)}l${round(-2 - r() * 3)},${round(18 + r() * 34)}`;
  }
  s.path(cliff, styles.faint);

  const shore = (x: number) => 306 + 8 * Math.sin(x / 150) - Math.max(0, x - 860) * 0.12;
  const foam: Pt[] = [];
  for (let x = -20; x <= 1080; x += 20) foam.push([x, shore(x) - 5]);
  pline(s, foam, styles.faint);
  ground(s, shore, styles.land);

  lifeguard(s, 600, 346);
  for (let k = 0; k < 18; k++) {
    const x = r() * VIEW.w;
    const y = HORIZON + 50 + r() * 160;
    if (!canStand(x, y) || onPad(x, y, 30) || Math.abs(x - 620) < 70) continue;
    const size = 8 + ((y - HORIZON) / 210) * 18;
    blob(s, x, y - size * 0.5, size * 1.4, size * 0.6, x, styles.top);
  }
  tufts(s, r, 120, HORIZON + 30);
}

function snowFir(s: Sketch, x: number, y: number, h: number): void {
  seg(s, x, y, x, y - h * 0.12, styles.edge);
  for (let t = 0; t < 4; t++) {
    const base = y - h * 0.1 - t * h * 0.2;
    const w = h * (0.5 - t * 0.1);
    const top = base - h * 0.34;
    poly(
      s,
      [
        [x - w / 2, base],
        [x, top],
        [x + w / 2, base],
      ],
      styles.top,
    );
    s.path(`M${round(x - w / 2 + 2)},${round(base - 2)}q${round(w / 4)},${round(-4)} ${round(w / 2 - 2)},-2t${round(w / 2 - 2)},2`, styles.faint);
  }
}

function snow(s: Sketch): void {
  const r = rng(97);
  ground(s, (x) => HORIZON - 40 - 100 * Math.pow(Math.abs(Math.cos(x / 250 + 0.4)), 3), styles.far);
  for (let x = -10; x < VIEW.w + 10; ) {
    const h = 16 + r() * 22;
    const w = h * 0.42;
    poly(
      s,
      [
        [x - w / 2, HORIZON - 2],
        [x, HORIZON - 2 - h],
        [x + w / 2, HORIZON - 2],
      ],
      styles.far,
    );
    x += 8 + r() * 8;
  }
  ground(s, (x) => HORIZON + 4 + 5 * Math.sin(x / 280), styles.land);

  const [lx, ly, lrx, lry] = [330, 410, 200, 26];
  s.el("ellipse", { cx: lx, cy: ly, rx: lrx, ry: lry, className: styles.sideL });
  s.path(`M${lx - 120},${ly - 4}q60,-10 120,-2M${lx - 40},${ly + 8}q70,-8 150,-4`, styles.faint);

  const trees: Pt[] = [];
  for (let k = 0; k < 34; k++) {
    const x = r() * VIEW.w;
    const y = HORIZON + 14 + r() * (VIEW.h - HORIZON - 20);
    const inLake = ((x - lx) / (lrx + 30)) ** 2 + ((y - ly) / (lry + 40)) ** 2 < 1;
    if (canStand(x, y, 30) && !inLake) trees.push([x, y]);
  }
  trees.sort((a, b) => a[1] - b[1]);
  for (const [x, y] of trees) snowFir(s, x, y, 40 + (y - HORIZON) * 0.4 + r() * 10);

  for (let k = 0; k < 160; k++) circle(s, r() * VIEW.w, r() * (VIEW.h - 10), 0.8 + r() * 1.4, styles.flake);
}

const DRAW = [
  { id: "city", label: "Downtown", draw: city },
  { id: "field", label: "Open prairie", draw: field },
  { id: "mountain", label: "Alpine ridge", draw: mountain },
  { id: "desert", label: "High desert", draw: desert },
  { id: "coast", label: "Coastline", draw: coast },
  { id: "snow", label: "Boreal winter", draw: snow },
] as const;

export interface Landscape {
  readonly id: string;
  readonly label: string;
  readonly items: readonly ReactElement[];
}

export const LANDSCAPES: readonly Landscape[] = DRAW.map(({ id, label, draw }) => {
  const s = new Sketch(styles);
  draw(s);
  return { id, label, items: s.items };
});

export const ZODE: ReactElement = (() => {
  const s = new Sketch(styles);
  zode(s);
  return <g transform={`translate(${ZODE_AT[0]} ${ZODE_AT[1]}) scale(${ZODE_SCALE})`}>{s.items}</g>;
})();
