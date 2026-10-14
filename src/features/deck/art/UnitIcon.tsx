import type { CSSProperties, ReactElement } from "react";
import { Sketch, backToFront, project, round, type Bounds, type P3 } from "@/features/zode-drawings/lineArt";
import styles from "./MacroArt.module.css";
import { meltingClock } from "./meltingClock";

export type UnitIconId =
  | "node"
  | "gpu"
  | "power"
  | "fabric"
  | "storage"
  | "rate"
  | "profit"
  | "revenue"
  | "prepay"
  | "building"
  | "gpuDebt";

type Pt = readonly [number, number];

const pts = (ps: readonly Pt[]) => ps.map(([x, y]) => `${round(x)},${round(y)}`).join(" ");

/** Props for a group animated while the icon plays; `k` staggers its start, `step` apart. */
const anim = (className: string, k = 0, step?: string) => ({
  className,
  style: { "--k": k, ...(step ? { "--step": step } : null) } as CSSProperties,
});

/** Points along the lower half of a flat circle's ellipse, from angle `from` to `to`. */
function arc(cx: number, cy: number, rx: number, from: number, to: number): Pt[] {
  return Array.from({ length: 17 }, (_, k) => {
    const t = from + ((to - from) * k) / 16;
    return [cx + rx * Math.cos(t), cy + (rx / 2) * Math.sin(t)] as const;
  });
}

/** A standing cylinder at (x, y): its near side, then its lid. */
function cylinder(s: Sketch, x: number, y: number, r: number, z0: number, h: number): void {
  const rx = r * Math.SQRT2;
  const [bx, by] = project([x, y, z0]);
  const [tx, ty] = project([x, y, z0 + h]);
  const side = [...arc(bx, by, rx, 0, Math.PI), ...arc(tx, ty, rx, Math.PI, 0)];
  for (const [px, py] of side) s.extend(px, py);
  s.el("polygon", { points: pts(side), className: styles.sideL });
  s.disc([x, y, z0 + h], r, styles.top);
}

/** A status light at `p`, blinking while the icon plays. */
function lamp(s: Sketch, p: P3, k: number, r = 1.3, step?: string): void {
  const [x, y] = project(p);
  s.extend(x, y, r);
  s.group(anim(styles.flash, k, step), () => s.el("circle", { cx: x, cy: y, r, className: styles.ring }));
}

/**
 * A flat outline in the xz plane, given as [x, z], extruded from `y0` to `y1`:
 * the sides turned toward the viewer, back to front, then its face.
 */
function extrude(s: Sketch, outline: readonly Pt[], y0: number, y1: number): void {
  const n = outline.length;
  let twice = 0;
  for (let i = 0; i < n; i++) {
    const [[ax, az], [bx, bz]] = [outline[i], outline[(i + 1) % n]];
    twice += ax * bz - bx * az;
  }
  const out = Math.sign(twice);
  const sides = outline
    .map(([ax, az], i) => {
      const [bx, bz] = outline[(i + 1) % n];
      const [nx, nz] = [out * (bz - az), out * (ax - bx)];
      return { ax, az, bx, bz, nx, nz, depth: ax + bx + az + bz };
    })
    .filter(({ nx, nz }) => nx + nz > 1e-6)
    .sort((a, b) => a.depth - b.depth);
  for (const { ax, az, bx, bz, nx, nz } of sides) {
    s.face(
      [
        [ax, y0, az],
        [bx, y0, bz],
        [bx, y1, bz],
        [ax, y1, az],
      ],
      nz > Math.abs(nx) ? styles.top : styles.sideR,
    );
  }
  s.face(
    outline.map(([x, z]): P3 => [x, y1, z]),
    styles.sideL,
  );
}

/** A GPU node: a server tray, its front vented, eight GPU modules on its board as cubes. */
function node(s: Sketch): void {
  const [X, Y, W, D, H] = [-32, -22, 64, 44, 8];
  s.box(X, Y, W, D, 0, H);
  for (let x = X + 6; x < X + W - 14; x += 4) s.line([[x, Y + D, 2], [x, Y + D, H - 2]]);
  lamp(s, [X + W - 8, Y + D, H / 2], 0);
  lamp(s, [X + W - 4, Y + D, H / 2], 1);
  const C = 11;
  const modules: { x: number; y: number }[] = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) modules.push({ x: X + 5 + i * 15, y: Y + 7 + j * 19 });
  modules
    .sort(backToFront)
    .forEach(({ x, y }, k) => s.group(anim(styles.shade, k), () => s.box(x, y, C, C, H, C)));
}

/** A GPU package: the substrate, its pins, and the lidded die, current running round it. */
function gpu(s: Sketch): void {
  s.box(-24, -24, 48, 48, 0, 4);
  for (let t = -18; t <= 18; t += 6) {
    s.line([[24, t, 1.5], [29, t, 1.5]], styles.edge);
    s.line([[t, 24, 1.5], [t, 29, 1.5]], styles.edge);
  }
  s.group(anim(styles.shade), () => s.box(-15, -15, 30, 30, 4, 6));
  s.group(anim(styles.flow), () =>
    s.line(
      [
        [-9, -9, 10],
        [9, -9, 10],
        [9, 9, 10],
        [-9, 9, 10],
        [-9, -9, 10],
      ],
      styles.edge,
    ),
  );
  lamp(s, [0, 0, 10], 0, 2);
}

/** The 24px bolt glyph, extruded and stood on a pad. */
function power(s: Sketch): void {
  const BOLT: Pt[] = [
    [13.25, 2.75],
    [4.75, 13.5],
    [11.75, 13.5],
    [10.75, 21.25],
    [19.25, 10.5],
    [12.25, 10.5],
  ];
  s.box(-18, -18, 36, 36, -3, 3);
  const ring: P3[] = Array.from({ length: 33 }, (_, k) => {
    const t = (k / 32) * Math.PI * 2;
    return [9 * Math.cos(t), 9 * Math.sin(t), 0];
  });
  s.group(anim(styles.flow), () => s.line(ring, styles.edge));
  s.group(anim(styles.shade), () =>
    extrude(
      s,
      BOLT.map(([x, y]): Pt => [(x - 12) * 2.6, (21.25 - y) * 2.6]),
      -4,
      4,
    ),
  );
}

/** Leaf and spine: two switches, ports on their fronts, joined by uplinks. */
function fabric(s: Sketch): void {
  const ports = (x0: number, w: number, y: number, z: number, n: number, k: number) => {
    for (let i = 0; i < n; i++) {
      const x = x0 + 4 + (i * (w - 8)) / n;
      s.face(
        [
          [x, y, z + 2.5],
          [x + 4, y, z + 2.5],
          [x + 4, y, z + 6.5],
          [x, y, z + 6.5],
        ],
        styles.top,
      );
    }
    lamp(s, [x0 + w, y - 4, z + 4.5], k);
  };
  s.box(-30, -12, 60, 24, 0, 9);
  ports(-30, 60, 12, 0, 7, 0);
  s.group(anim(styles.flow), () => {
    for (const x of [-16, 0, 16]) s.line([[x, 0, 9], [x * 0.6, 0, 26]], styles.edge);
  });
  s.box(-20, -10, 40, 20, 26, 9);
  ports(-20, 40, 10, 26, 5, 2);
}

/** Three storage drums stacked, pulsing up the stack, a light on each. */
function storage(s: Sketch): void {
  const [R, H, GAP] = [20, 9, 3.5];
  for (let k = 0; k < 3; k++) {
    const z = k * (H + GAP);
    s.group(anim(styles.shade, k * 2), () => cylinder(s, 0, 0, R, z, H));
    lamp(s, [R * 0.72, R * 0.72, z + H / 2], k);
  }
}

/**
 * A clock melting on a GPU, after Dalí: lying on the die, slumping over its
 * front edge and running out across the substrate, the dial and hands
 * drooping with it, a light sweeping the dial clockwise once a cycle.
 */
function rate(s: Sketch): void {
  const [SUB, Z0, Z1, DX, DY0, DY1] = [26, 4, 12, 17, -20, 8];
  s.box(-SUB, -SUB, 2 * SUB, 2 * SUB, 0, Z0);
  for (let t = -SUB + 5; t <= SUB - 5; t += 6) {
    s.line([[SUB, t, 1.5], [SUB + 5, t, 1.5]], styles.edge);
    s.line([[t, SUB, 1.5], [t, SUB + 5, 1.5]], styles.edge);
  }
  s.box(-DX, DY0, 2 * DX, DY1 - DY0, Z0, Z1 - Z0);

  const { polar, hand } = meltingClock(s, {
    x: 0,
    r: 15,
    thickness: 2,
    hub: -4,
    drip: 7,
    lean: -2.5,
    corners: [
      [DY1, Z1, 3],
      [DY1, Z0, 2.5],
    ],
  });
  for (let k = 0; k < 12; k++) lamp(s, polar(6.5, (k / 12) * Math.PI * 2), k, 1, "150ms");
  s.line([...hand(6, (5 / 3) * Math.PI).reverse(), ...hand(11, (5 / 6) * Math.PI)], styles.edge);
  s.disc(polar(0, 0), 1, styles.ink);
}

/** Profit kept: two stacks of coins pulsing up from the base, a coin settling on the taller. */
function profit(s: Sketch): void {
  const [R, T] = [13, 3.5];
  const STACKS = [
    [-14, 6, 4],
    [10, -6, 7],
  ] as const;
  for (const [x, y, n] of STACKS) {
    for (let k = 0; k < n; k++) s.group(anim(styles.shade, k), () => cylinder(s, x, y, R, k * T, T));
    s.disc([x, y, n * T], R * 0.62, styles.fine);
  }
  s.group(anim(styles.shade, 8), () => cylinder(s, 10, -6, R, 7 * T + 9, T));
}

/** Rising bars on a plinth, a trend line climbing over them. */
function revenue(s: Sketch): void {
  const BARS = [
    [-22, 12],
    [-6, 22],
    [10, 34],
  ] as const;
  s.box(-28, -14, 52, 28, 0, 3);
  BARS.forEach(([x, h], k) => s.group(anim(styles.shade, k), () => s.box(x, -5, 10, 10, 3, h)));
  const trend: P3[] = BARS.map(([x, h]) => [x + 5, 0, h + 10]);
  s.group(anim(styles.flow), () => s.line([...trend, [26, 0, 52]], styles.edge));
  s.line(
    [
      [19, 0, 52],
      [26, 0, 52],
      [26, 0, 45],
    ],
    styles.edge,
  );
}

/** A take-or-pay contract lying signed, coins prepaid on its corner pulsing up the stack, its seal blinking. */
function prepay(s: Sketch): void {
  const [X, Y, T] = [22, 28, 1.5];
  s.box(-X, -Y, 2 * X, 2 * Y, 0, T);
  s.line([[-X + 6, -Y + 8, T], [-X + 13, -Y + 8, T]], styles.edge);
  [0, 5, 10].forEach((y, k) => s.line([[-X + 6, y, T], [X - 6 - (k % 2) * 8, y, T]]));
  s.group(anim(styles.flow), () =>
    s.line(
      Array.from({ length: 17 }, (_, k): P3 => [-X + 6 + k, 19 + 1.6 * Math.sin(k * 0.9), T]),
      styles.edge,
    ),
  );
  s.disc([X - 8, Y - 8, T], 4.5, styles.fine);
  lamp(s, [X - 8, Y - 8, T], 3, 1.8);
  for (let k = 0; k < 3; k++) s.group(anim(styles.shade, k), () => cylinder(s, 11, -15, 9, T + k * 3.5, 3.5));
}

/** A powered hall on its surveyed lot: the lot's boundary running, a transformer at its side, a light by its loading door. */
function building(s: Sketch): void {
  const [X, Y] = [31, 19];
  const [BX, BY, W, D, H, ROOF] = [-26, -13, 42, 22, 15, 4];
  const [X1, Y1, YM] = [BX + W, BY + D, BY + D / 2];
  s.box(-X, -Y, 2 * X, 2 * Y, -3, 3);
  s.group(anim(styles.flow), () =>
    s.line(
      [
        [-X + 4, -Y + 4, 0],
        [X - 4, -Y + 4, 0],
        [X - 4, Y - 4, 0],
        [-X + 4, Y - 4, 0],
        [-X + 4, -Y + 4, 0],
      ],
      styles.dash,
    ),
  );
  s.box(BX, BY, W, D, 0, H);
  s.face(
    [
      [BX, BY, H],
      [X1, BY, H],
      [X1, YM, H + ROOF],
      [BX, YM, H + ROOF],
    ],
    styles.top,
  );
  s.face(
    [
      [X1, BY, H],
      [X1, Y1, H],
      [X1, YM, H + ROOF],
    ],
    styles.sideR,
  );
  s.face(
    [
      [BX, YM, H + ROOF],
      [X1, YM, H + ROOF],
      [X1, Y1, H],
      [BX, Y1, H],
    ],
    styles.top,
  );
  for (let x = BX + 4; x <= BX + W - 4; x += 4) s.line([[x, Y1, 11], [x, Y1, H - 1]]);
  s.face(
    [
      [BX + 8, Y1, 0],
      [BX + 20, Y1, 0],
      [BX + 20, Y1, 9],
      [BX + 8, Y1, 9],
    ],
    styles.top,
  );
  for (let z = 3; z < 9; z += 3) s.line([[BX + 8, Y1, z], [BX + 20, Y1, z]]);
  lamp(s, [BX + 23, Y1, 7], 0);
  s.line([[X1, 0, 12], [X1 + 6, 0, 12], [X1 + 6, 0, 9]], styles.edge);
  s.group(anim(styles.shade, 2), () => s.box(X1 + 3, -5, 7, 10, 0, 9));
  lamp(s, [X1 + 10, 2, 6], 1);
}

/** Senior debt on the GPUs: the package resting on a stack of coins pulsing up under it, current running round the die. */
function gpuDebt(s: Sketch): void {
  const [R, T, N] = [15, 4, 4];
  for (let k = 0; k < N; k++) s.group(anim(styles.shade, k), () => cylinder(s, 0, 0, R, k * T, T));
  const Z = N * T;
  s.box(-19, -19, 38, 38, Z, 3);
  s.box(-11, -11, 22, 22, Z + 3, 5);
  s.group(anim(styles.flow), () =>
    s.line(
      [
        [-6, -6, Z + 8],
        [6, -6, Z + 8],
        [6, 6, Z + 8],
        [-6, 6, Z + 8],
        [-6, -6, Z + 8],
      ],
      styles.edge,
    ),
  );
  lamp(s, [0, 0, Z + 8], 3, 1.6);
}

const DRAW: Record<UnitIconId, (s: Sketch) => void> = {
  node,
  gpu,
  power,
  fabric,
  storage,
  rate,
  profit,
  revenue,
  prepay,
  building,
  gpuDebt,
};

const ART = new Map<UnitIconId, { items: ReactElement[]; view: Bounds }>();

/** Drawn on first use. */
function artFor(id: UnitIconId): { items: ReactElement[]; view: Bounds } {
  let art = ART.get(id);
  if (!art) {
    const s = new Sketch(styles);
    DRAW[id](s);
    art = { items: s.items, view: s.bounds(3) };
    ART.set(id, art);
  }
  return art;
}

/**
 * A small isometric line drawing for the unit and finance slides' cards, in
 * the macro drawings' style: drawn for the ink ground unless `light`, its
 * lights and lines running while `playing`.
 */
export function UnitIcon({
  id,
  light = false,
  playing = false,
  className,
}: {
  id: UnitIconId;
  light?: boolean;
  playing?: boolean;
  className?: string;
}): ReactElement {
  const { items, view } = artFor(id);
  return (
    <svg
      className={className ? `${styles.art} ${className}` : styles.art}
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      data-light={light || undefined}
      data-playing={playing || undefined}
      aria-hidden="true"
    >
      {items}
    </svg>
  );
}
