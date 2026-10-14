import type { CSSProperties, ReactElement } from "react";
import { Sketch, project, rng, round, type Bounds, type P3 } from "@/features/zode-drawings/lineArt";
import type { MacroArtId } from "../slides";
import styles from "./MacroArt.module.css";

/** Props for a group animated while the drawing plays; `k` staggers its start. */
const anim = (className: string, k = 0) => ({ className, style: { "--k": k } as CSSProperties });

type Pt = readonly [number, number];

const pts = (ps: readonly Pt[]) => ps.map(([x, y]) => `${round(x)},${round(y)}`).join(" ");

function circle(s: Sketch, cx: number, cy: number, r: number, className: string): void {
  s.extend(cx, cy, r);
  s.el("circle", { cx: round(cx), cy: round(cy), r: round(r), className });
}

function seg(s: Sketch, x1: number, y1: number, x2: number, y2: number, className: string): void {
  s.extend(x1, y1);
  s.extend(x2, y2);
  s.el("line", { x1: round(x1), y1: round(y1), x2: round(x2), y2: round(y2), className });
}

function poly(s: Sketch, ps: readonly Pt[], className: string): void {
  for (const [x, y] of ps) s.extend(x, y);
  s.el("polygon", { points: pts(ps), className });
}

/** Points along the lower half of a flat circle's ellipse, from angle `from` to `to`. */
function arc(cx: number, cy: number, rx: number, from: number, to: number): Pt[] {
  const out: Pt[] = [];
  for (let k = 0; k <= 16; k++) {
    const t = from + ((to - from) * k) / 16;
    out.push([cx + rx * Math.cos(t), cy + (rx / 2) * Math.sin(t)]);
  }
  return out;
}

/**
 * Points round a flat rectangle with corners of radius `r`, by outward normal
 * angle from `from` to `to`: π faces -x, 1.5π -y, 2π +x, 2.5π +y, up to 3π.
 * A straight side shares its normal with both its ends; a run takes the first.
 */
function rounded(x0: number, y0: number, x1: number, y1: number, r: number, from = Math.PI, to = 3 * Math.PI): Pt[] {
  const centres: Pt[] = [
    [x0 + r, y0 + r],
    [x1 - r, y0 + r],
    [x1 - r, y1 - r],
    [x0 + r, y1 - r],
  ];
  const ps = centres.flatMap(([cx, cy], q) =>
    Array.from({ length: 7 }, (_, k) => {
      const t = Math.PI * (1 + (q + k / 6) / 2);
      return { t, p: [cx + r * Math.cos(t), cy + r * Math.sin(t)] as const };
    }),
  );
  const at = (a: number) => ps.findIndex(({ t }) => t > a - 1e-6);
  return ps.slice(at(from), at(to) + 1).map(({ p }) => p);
}

/** A stack of `n` coins, `t` thick, standing at (x, y). */
function coins(s: Sketch, x: number, y: number, r: number, n: number, t: number): void {
  const rx = round(r * Math.SQRT2);
  const [bx, by] = project([x, y, 0]);
  const [tx, ty] = project([x, y, n * t]);
  poly(s, [...arc(bx, by, rx, 0, Math.PI), ...arc(tx, ty, rx, Math.PI, 0)], styles.sideL);
  for (let k = 1; k < n; k++) {
    const [cx, cy] = project([x, y, k * t]);
    s.el("polyline", { points: pts(arc(cx, cy, rx, 0, Math.PI)), className: styles.fine });
  }
  s.disc([x, y, n * t], r, styles.top);
  s.disc([x, y, n * t], r * 0.62, styles.fine);
}

/** Three stacks of coins of rising height. */
function capital(s: Sketch): void {
  const stacks = [
    [-34, -30, 7],
    [26, -40, 11],
    [-20, 26, 4],
    [40, 16, 9],
  ] as const;
  [...stacks]
    .sort((a, b) => a[0] + a[1] - (b[0] + b[1]))
    .forEach(([x, y, n], k) => s.group(anim(styles.shade, k), () => coins(s, x, y, 20, n, 6)));
}

/** A conductor from `a` to `b`, sagging `dip` at its middle. */
function span(a: P3, b: P3, dip: number): P3[] {
  const [ax, ay, az = 0] = a;
  const [bx, by, bz = 0] = b;
  return Array.from({ length: 13 }, (_, k) => {
    const t = k / 12;
    return [ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t - dip * 4 * t * (1 - t)] as const;
  });
}

/** An insulator: a stem from `z0` to `z1` ringed with sheds. */
function insulator(s: Sketch, x: number, y: number, z0: number, z1: number, r: number): void {
  s.line([[x, y, z0], [x, y, z1]], styles.edge);
  const sheds = Math.max(2, Math.round((z1 - z0) / 4));
  for (let k = 0; k < sheds; k++) s.disc([x, y, z0 + ((z1 - z0) * (k + 0.5)) / sheds], r, styles.ring);
}

/** An H-frame gantry at `x`: two steel posts and a beam carrying the three phases. */
function gantry(s: Sketch, x: number, half: number, h: number): void {
  s.box(x - 2, -half - 2, 4, 4, 4, h);
  s.box(x - 2, -half - 2, 4, 2 * half + 4, h - 4, 4);
  s.box(x - 2, half - 2, 4, 4, 4, h - 4);
}

/**
 * A substation on its pad: the grid arrives solid at the gantry on the left,
 * steps down through the transformer and leaves dashed on the right, short of supply.
 */
function power(s: Sketch): void {
  const PHASES = [-18, 0, 18];
  const [IN, OUT] = [-66, 62];
  const [IN_H, OUT_H] = [86, 62];
  const [HV, LV, TOP] = [-12, 12, 42];

  s.box(-80, -46, 160, 92, 0, 4);
  for (let x = -72; x <= 72; x += 16) s.line([[x, -46, 4], [x, 46, 4]], styles.trace);

  PHASES.forEach((y, k) =>
    s.group(anim(styles.flow, k), () => s.line(span([-116, y, IN_H + 2], [IN, y, IN_H - 16], 6), styles.edge)),
  );
  gantry(s, IN, 34, IN_H);
  for (const y of PHASES) insulator(s, IN, y, IN_H - 16, IN_H - 4, 2.2);

  s.group(anim(styles.shade), () => s.box(-30, -28, 60, 56, 4, TOP - 4));
  for (const y of PHASES) {
    insulator(s, HV, y, TOP, TOP + 20, 3);
    insulator(s, LV, y, TOP, TOP + 12, 2.6);
  }
  for (let x = -24; x <= 24; x += 6) s.box(x - 1, 28, 2, 8, 10, 24);

  for (const y of PHASES) s.line(span([IN, y, IN_H - 16], [HV, y, TOP + 20], 4), styles.edge);
  gantry(s, OUT, 30, OUT_H);
  for (const y of PHASES) {
    insulator(s, OUT, y, OUT_H - 14, OUT_H - 4, 2);
    s.line(span([LV, y, TOP + 12], [OUT, y, OUT_H - 14], 3), styles.edge);
    s.line(span([OUT, y, OUT_H - 14], [112, y, OUT_H - 10], 6), styles.dash);
  }
}

/** A GPU node: a chassis with eight finned heat sinks. */
function compute(s: Sketch): void {
  s.box(-112, -58, 224, 116, 0, 16);
  for (let x = -102; x <= -46; x += 5) s.line([[x, 58, 4], [x, 58, 12]]);
  s.line([[96, 58, 3], [96, 58, 13]], styles.edge);
  s.line([[104, 58, 3], [104, 58, 13]], styles.edge);

  const sinks: { x: number; y: number }[] = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) sinks.push({ x: -100 + i * 52, y: -48 + j * 50 });
  sinks
    .sort((a, b) => a.x + a.y - (b.x + b.y))
    .forEach(({ x, y }, k) => {
      s.group(anim(styles.shade, k), () => s.box(x, y, 40, 42, 16, 14));
      for (let fx = x + 5; fx < x + 40; fx += 5) s.line([[fx, y, 30], [fx, y + 42, 30]]);
    });
}

/** A surveyed parcel, its corner pins marked. */
function land(s: Sketch): void {
  const [X, Y] = [100, 64];
  const corners: P3[] = [
    [-X, -Y],
    [X, -Y],
    [X, Y],
    [-X, Y],
  ];
  for (let x = -X + 25; x < X; x += 25) s.line([[x, -Y], [x, Y]], styles.trace);
  for (let y = -Y + 32; y < Y; y += 32) s.line([[-X, y], [X, y]], styles.trace);
  s.group(anim(styles.flow), () => s.line([...corners, corners[0]], styles.dash));
  corners.forEach(([x, y], k) => {
    s.line([[x, y, 0], [x, y, 18]], styles.edge);
    const [px, py] = project([x, y, 18]);
    s.group(anim(styles.flash, k), () => circle(s, px, py, 3, styles.ring));
  });
}

/** A data center: a ribbed hall with cooling units on its roof. */
function datacenter(s: Sketch): void {
  const [X, Y, H] = [64, 40, 76];
  s.box(-X, -Y, 2 * X, 2 * Y, 0, H);
  for (let x = -X + 8; x <= X - 8; x += 8) s.line([[x, Y, 6], [x, Y, H - 6]]);
  s.face(
    [
      [X, -12, 0],
      [X, 12, 0],
      [X, 12, 34],
      [X, -12, 34],
    ],
    styles.fine,
  );
  s.line([[X, 0, 0], [X, 0, 34]]);
  for (const y of [-28, 22]) s.line([[X, y, H - 22], [X, y + 6, H - 22]], styles.edge);
  [-52, -8].forEach((x, k) => {
    s.group(anim(styles.shade, k), () => s.box(x, -24, 36, 48, H, 12));
    s.disc([x + 18, 0, H + 12], 12, styles.ring);
    s.disc([x + 18, 0, H + 12], 2.4, styles.ink);
  });
}

/** A signed take-or-pay contract under its seal. */
function offtake(s: Sketch): void {
  const [L, T, W, H, F] = [-56, -78, 112, 156, 18];
  poly(
    s,
    [
      [L, T],
      [L + W - F, T],
      [L + W, T + F],
      [L + W, T + H],
      [L, T + H],
    ],
    styles.top,
  );
  poly(
    s,
    [
      [L + W - F, T],
      [L + W - F, T + F],
      [L + W, T + F],
    ],
    styles.sideR,
  );
  seg(s, L + 14, T + 22, L + 60, T + 22, styles.edge);
  [40, 52, 64, 76, 88].forEach((dy, k) => seg(s, L + 14, T + dy, L + W - 14 - (k % 2) * 18, T + dy, styles.fine));
  seg(s, L + 14, T + 130, L + 62, T + 130, styles.fine);
  s.group(anim(styles.flow), () =>
    s.path(`M ${L + 16} ${T + 124} c 6 -14 10 -14 12 -4 s 6 10 10 -2 s 8 -10 10 0 s 6 6 12 -2`, styles.edge),
  );
  s.extend(L + 16, T + 112);
  s.group(anim(styles.flash), () => circle(s, L + W - 24, T + H - 26, 14, styles.ring));
  circle(s, L + W - 24, T + H - 26, 9, styles.fine);
}

/** A rack cabinet at (x, y), its front (+y) ruled into servers. */
function rack(s: Sketch, x: number, y: number, w: number, d: number, h: number): void {
  s.box(x, y, w, d, 0, h);
  for (let z = 8; z < h - 4; z += 6) s.line([[x + 3, y + d, z], [x + w - 3, y + d, z]]);
}

/** A leased-out hall: two rows of racks, one slot in the front row still open. */
function vacancy(s: Sketch): void {
  const [W, D, H, STEP] = [16, 22, 44, 18];
  const OPEN = 3;
  s.box(-64, -46, 128, 92, -4, 4);
  for (const [y, row] of [
    [-34, 0],
    [12, 1],
  ] as const) {
    for (let i = 0; i < 6; i++) {
      const x = -54 + i * STEP;
      if (row === 1 && i === OPEN) {
        s.group(anim(styles.flow), () =>
          s.line(
            [
              [x, y],
              [x + W, y],
              [x + W, y + D],
              [x, y + D],
              [x, y],
            ],
            styles.dash,
          ),
        );
      } else {
        s.group(anim(styles.shade, i + row * 2), () => rack(s, x, y, W, D, H));
      }
    }
  }
}

/** A hall going up: the first bay clad, the rest a steel frame, under a tower crane. */
function construction(s: Sketch): void {
  const [Y, H] = [30, 48];
  const BAYS = [-60, -24, 12, 48];
  const [MX, MY, MH] = [-40, -58, 112];

  s.box(MX - 4, MY - 4, 8, 8, 0, MH);
  for (let z = 10; z < MH; z += 10) s.line([[MX + 4, MY - 4, z - 10], [MX + 4, MY + 4, z]]);
  s.line([[MX - 36, MY, MH + 4], [MX + 112, MY, MH + 4]], styles.edge);
  s.line([[MX, MY, MH + 22], [MX + 112, MY, MH + 4]]);
  s.line([[MX, MY, MH + 22], [MX - 36, MY, MH + 4]]);
  s.box(MX - 36, MY - 5, 12, 10, MH - 8, 12);
  s.group(anim(styles.flow), () => s.line([[MX + 84, MY, MH + 4], [MX + 84, MY, H + 30]], styles.dash));
  s.box(MX + 76, MY - 6, 16, 12, H + 18, 12);

  s.box(-68, -Y - 8, 136, 2 * Y + 16, -4, 4);
  s.group(anim(styles.shade), () => s.box(BAYS[0], -Y, BAYS[1] - BAYS[0], 2 * Y, 0, H));
  for (const x of BAYS.slice(1)) {
    for (const y of [-Y, Y]) s.line([[x, y, 0], [x, y, H]], styles.edge);
    s.line([[x, -Y, H], [x, Y, H]], styles.edge);
  }
  for (const y of [-Y, Y]) s.line([[BAYS[1], y, H], [BAYS[3], y, H]], styles.edge);
  for (let k = 1; k < BAYS.length - 1; k++) {
    const [x0, x1] = [BAYS[k], BAYS[k + 1]];
    s.line([[x0, Y, 0], [x1, Y, H]]);
    s.line([[x0, Y, H / 2], [x1, Y, H / 2]]);
  }
}

/** Modules absorbed: last year's stack, then this year's, twice as tall, its new half pulsing. */
function absorption(s: Sketch): void {
  const [W, H, GAP] = [34, 18, 3];
  const stack = (x: number, n: number, fresh: number) => {
    for (let k = 0; k < n; k++) {
      const draw = () => s.box(x, -W / 2, W, W, k * (H + GAP), H);
      if (k < n - fresh) draw();
      else s.group(anim(styles.shade, k), draw);
    }
  };
  s.box(-56, -32, 112, 64, -4, 4);
  stack(-44, 2, 0);
  stack(10, 4, 2);
}

/** A gabled box at (x, y), its ridge along x, `roof` above the eaves. */
function gabled(s: Sketch, x: number, y: number, w: number, d: number, h: number, roof: number): void {
  const [x1, y1, ym] = [x + w, y + d, y + d / 2];
  s.box(x, y, w, d, 0, h);
  s.face(
    [
      [x, y, h],
      [x1, y, h],
      [x1, ym, h + roof],
      [x, ym, h + roof],
    ],
    styles.top,
  );
  s.face(
    [
      [x1, y, h],
      [x1, y1, h],
      [x1, ym, h + roof],
    ],
    styles.sideR,
  );
  s.face(
    [
      [x, ym, h + roof],
      [x1, ym, h + roof],
      [x1, y1, h],
      [x, y1, h],
    ],
    styles.top,
  );
}

/** The edges of a box at (x, y) not yet built: its outline, dashed. */
function outline(s: Sketch, x: number, y: number, w: number, d: number, h: number): void {
  const [x1, y1] = [x + w, y + d];
  const ring = (z: number): P3[] => [
    [x, y, z],
    [x1, y, z],
    [x1, y1, z],
    [x, y1, z],
    [x, y, z],
  ];
  s.line(ring(0), styles.dash);
  s.line(ring(h), styles.dash);
  for (const [px, py] of [
    [x, y1],
    [x1, y1],
    [x1, y],
  ] as const)
    s.line([[px, py, 0], [px, py, h]], styles.dash);
}

/** A stack of permits years deep, beside a clock. */
function regulation(s: Sketch): void {
  const [W, D, T] = [64, 84, 6];
  for (let k = 0; k < 9; k++) {
    const dx = ((k * 5) % 3) * 3 - 3;
    const dy = ((k * 7) % 3) * 3 - 3;
    s.group(anim(styles.shade, k), () => s.box(-64 + dx, -42 + dy, W, D, k * T, T));
  }
  const z = 9 * T;
  for (const y of [-26, -16, -6, 4, 14]) s.line([[-54, y, z], [-54 + (y % 4 ? 34 : 44), y, z]], styles.fine);

  const [CX, CY, CZ, R] = [44, 4, 46, 28];
  s.box(CX - 6, CY - 8, 12, 16, 0, CZ - R + 2);
  s.wheel([CX, CY, CZ], R, "yz", styles.top);
  s.wheel([CX, CY, CZ], R - 4, "yz", styles.fine);
  for (let k = 0; k < 12; k++) {
    const t = (k / 12) * Math.PI * 2;
    const [c, n] = [Math.cos(t), Math.sin(t)];
    s.line([[CX, CY + (R - 8) * c, CZ + (R - 8) * n], [CX, CY + (R - 5) * c, CZ + (R - 5) * n]], styles.edge);
  }
  s.line([[CX, CY, CZ], [CX, CY, CZ + R * 0.62]], styles.edge);
  s.group(anim(styles.flow), () => s.line([[CX, CY, CZ], [CX, CY + R * 0.7, CZ - R * 0.3]], styles.edge));
  const [hx, hy] = project([CX, CY, CZ]);
  s.group(anim(styles.flash), () => circle(s, hx, hy, 2.4, styles.ring));
}

/** Three buildings on three pads, each built its own way, the last still a dashed outline. */
function localBuild(s: Sketch): void {
  const SITES = [
    [-60, 20, 2],
    [-14, -14, 6],
    [32, -48, 4],
  ] as const;
  SITES.forEach(([x, y, pad], k) => {
    s.box(x - 6, y - 6, 40, 40, -pad, pad);
    if (k === 0) s.group(anim(styles.shade, 0), () => gabled(s, x, y, 28, 28, 22, 12));
    else if (k === 1)
      s.group(anim(styles.shade, 1), () => {
        s.box(x, y, 28, 28, 0, 40);
        for (let z = 8; z < 38; z += 8) s.line([[x + 4, y + 28, z], [x + 24, y + 28, z]]);
      });
    else s.group(anim(styles.flow), () => outline(s, x, y, 28, 28, 30));
  });
}

/** Shipping containers stacked two by two, the top front one missing. */
function supplyChain(s: Sketch): void {
  const [L, D, H] = [72, 26, 24];
  s.box(-48, -40, 96, 76, -4, 4);
  const slots = [
    [-36, 0],
    [-36, 1],
    [-6, 0],
    [-6, 1],
  ] as const;
  slots.forEach(([y, level], k) => {
    const z = level * H;
    if (k === 3) {
      s.group(anim(styles.flow), () => outline(s, -36, y, L, D, H));
      return;
    }
    s.group(anim(styles.shade, k), () => {
      s.box(-36, y, L, D, z, H);
      for (let x = -32; x < L - 36; x += 6) s.line([[x, y + D, z + 3], [x, y + D, z + H - 3]]);
      s.line([[L - 36, y + 8, z + 3], [L - 36, y + 8, z + H - 3]], styles.edge);
      s.line([[L - 36, y + 18, z + 3], [L - 36, y + 18, z + H - 3]], styles.edge);
    });
  });
}

/** Capital held back: coins on one side, a dashed line to a build that never starts. */
function financing(s: Sketch): void {
  [
    [-70, -30, 8],
    [-30, -50, 11],
  ].forEach(([x, y, n], k) => s.group(anim(styles.shade, k), () => coins(s, x, y, 18, n, 6)));
  s.line(
    [
      [-34, 10, 0],
      [4, 10, 0],
    ],
    styles.trace,
  );
  s.group(anim(styles.flow), () => outline(s, 18, -16, 56, 44, 44));
}

/** A windowless hall over the houses beside it, its hum rolling out toward them. */
function monolith(s: Sketch): void {
  const [X0, Y0, W, D, H] = [-80, -60, 140, 70, 64];
  s.box(X0, Y0, W, D, 0, H);
  for (let x = X0 + 8; x < X0 + W; x += 8) s.line([[x, Y0 + D, 6], [x, Y0 + D, H - 6]]);
  for (const x of [X0 + 24, X0 + 64, X0 + 104]) {
    s.box(x - 12, Y0 + 14, 24, 24, H, 8);
    s.disc([x, Y0 + 26, H + 8], 9, styles.ring);
  }
  const [cx, cy] = [X0 + W / 2, Y0 + D];
  [16, 28, 40].forEach((r, k) =>
    s.group(anim(styles.flow, k), () =>
      s.line(
        Array.from({ length: 13 }, (_, i) => {
          const t = Math.PI * (0.15 + (0.7 * i) / 12);
          return [cx + r * Math.cos(t) * 1.6, cy + r * Math.sin(t), 2] as const;
        }),
        styles.edge,
      ),
    ),
  );
  for (const [x, y] of [
    [-90, 40],
    [-40, 58],
    [10, 52],
  ] as const)
    gabled(s, x, y, 22, 18, 14, 9);
}

/** A cooling tower drawing from a pond, its vapour rising. */
function water(s: Sketch): void {
  s.disc([-66, 52, 0], 30, styles.top);
  s.disc([-66, 52, 0], 20, styles.trace);
  s.disc([-66, 52, 0], 10, styles.trace);
  s.group(anim(styles.flow), () =>
    s.line(
      [
        [-44, 34, 1],
        [-10, 6, 1],
        [6, -8, 1],
      ],
      styles.edge,
    ),
  );

  const [x, y] = [30, -30];
  const radius = (z: number) => 22 + 14 * ((z - 60) / 60) ** 2 * (z < 60 ? 1 : 0.45);
  const at = (z: number) => {
    const [cx, cy] = project([x, y, z]);
    return { cx, cy, rx: round(radius(z) * Math.SQRT2) };
  };
  const zs = Array.from({ length: 11 }, (_, k) => k * 10);
  const base = at(0);
  const top = at(100);
  poly(
    s,
    [
      ...arc(base.cx, base.cy, base.rx, Math.PI, 0),
      ...zs.map((z) => [at(z).cx + at(z).rx, at(z).cy] as Pt),
      ...arc(top.cx, top.cy, top.rx, 0, Math.PI),
      ...[...zs].reverse().map((z) => [at(z).cx - at(z).rx, at(z).cy] as Pt),
    ],
    styles.sideL,
  );
  for (const z of [20, 40, 60, 80]) {
    const ring = at(z);
    s.el("polyline", { points: pts(arc(ring.cx, ring.cy, ring.rx, 0, Math.PI)), className: styles.fine });
  }
  s.disc([x, y, 100], radius(100), styles.top);
  s.disc([x, y, 100], radius(100) * 0.7, styles.fine);
  [-14, 0, 14].forEach((dx, k) =>
    s.group(anim(styles.flow, k), () =>
      s.path(`M ${top.cx + dx} ${top.cy - 6} c -6 -8 6 -14 0 -22 s 6 -14 0 -22`, styles.edge),
    ),
  );
  s.extend(top.cx, top.cy - 52);
}

/** A power bill, its monthly bars climbing. */
function powerBill(s: Sketch): void {
  const [L, T, W, H, F] = [-60, -80, 120, 160, 18];
  poly(
    s,
    [
      [L, T],
      [L + W - F, T],
      [L + W, T + F],
      [L + W, T + H],
      [L, T + H],
    ],
    styles.top,
  );
  poly(
    s,
    [
      [L + W - F, T],
      [L + W - F, T + F],
      [L + W, T + F],
    ],
    styles.sideR,
  );
  poly(
    s,
    [
      [L + 22, T + 14],
      [L + 14, T + 30],
      [L + 20, T + 30],
      [L + 16, T + 44],
      [L + 28, T + 24],
      [L + 22, T + 24],
      [L + 26, T + 14],
    ],
    styles.ring,
  );
  seg(s, L + 38, T + 22, L + 84, T + 22, styles.edge);
  seg(s, L + 38, T + 34, L + 72, T + 34, styles.fine);
  const BASE = T + H - 18;
  seg(s, L + 14, BASE, L + W - 14, BASE, styles.edge);
  [16, 22, 30, 40, 54, 72].forEach((h, k) => {
    const x = L + 18 + k * 15;
    s.group(anim(styles.flash, k), () =>
      poly(
        s,
        [
          [x, BASE],
          [x, BASE - h],
          [x + 9, BASE - h],
          [x + 9, BASE],
        ],
        styles.ring,
      ),
    );
  });
}

/** Money flowing past the houses into the hall's own stack. */
function economics(s: Sketch): void {
  s.box(-6, -76, 84, 56, 0, 46);
  for (let x = 2; x < 78; x += 8) s.line([[x, -20, 6], [x, -20, 40]]);
  s.group(anim(styles.shade, 0), () => coins(s, 100, -30, 16, 9, 6));
  s.line(
    [
      [-100, -6, 0],
      [60, -6, 0],
    ],
    styles.trace,
  );
  s.group(anim(styles.flow), () =>
    s.line(
      [
        [-60, 40, 1],
        [40, 40, 1],
        [96, 0, 1],
      ],
      styles.edge,
    ),
  );
  for (const [x, y] of [
    [-96, 26],
    [-60, 50],
  ] as const)
    gabled(s, x, y, 22, 18, 14, 9);
}

/** A lightning bolt standing in the plane facing +y at (x, y), `h` tall from `z`. */
function bolt(s: Sketch, x: number, y: number, z: number, h: number): void {
  const k = h / 28;
  const shape: Pt[] = [
    [2, 28],
    [-4, 14],
    [1, 14],
    [-3, 0],
    [7, 17],
    [2, 17],
    [6, 28],
  ];
  s.face(
    shape.map(([u, v]) => [x + u * k, y, z + v * k] as const),
    styles.ring,
  );
}

/**
 * A digital signature on a tablet: a "sign here" tab pulses beside the field,
 * the signature types itself in byte by byte, `0x` then two rows of hex pairs,
 * and the certificate shield floating at the end of the dashed link turns solid.
 */
function signature(s: Sketch): void {
  const Z = 6;
  const flat = (ps: readonly Pt[], z = Z): P3[] => ps.map(([x, y]) => [x, y, z]);
  const BEVEL = Z - 1.5;
  const slab = (from: number, to: number) => rounded(-72, -52, 72, 52, 12, from, to);
  const band = (from: number, to: number, className: string) =>
    s.face([...flat(slab(from, to), 0), ...flat(slab(from, to), BEVEL).reverse()], className);
  band(1.75 * Math.PI, 2.25 * Math.PI, styles.sideR);
  band(2.25 * Math.PI, 2.75 * Math.PI, styles.sideL);
  s.line([[30, 52, BEVEL / 2], [52, 52, BEVEL / 2]], styles.edge);
  s.face(flat(slab(Math.PI, 3 * Math.PI), BEVEL), styles.sideR);
  s.face(flat(rounded(-70.5, -50.5, 70.5, 50.5, 10.5)), styles.sideL);
  s.face(flat(rounded(-69, -6, -67.6, 6, 0.7)), styles.ring);

  const screen = (from?: number, to?: number) => flat(rounded(-66, -46, 66, 46, 7, from, to));
  s.face(screen(), styles.top);
  s.face(screen(Math.PI, 2 * Math.PI), styles.sideL);
  for (const x of [-60, -56, -52]) s.disc([x, -42.5, Z], 1, styles.ring);
  for (const [x, y, u, v] of [
    [-62, -35, 1, 1],
    [62, -35, -1, 1],
    [62, 42, -1, -1],
    [-62, 42, 1, -1],
  ])
    s.line(
      flat([
        [x + 4 * u, y],
        [x, y],
        [x, y + 4 * v],
      ]),
      styles.fine,
    );
  s.line([[-54, -30, Z], [-14, -30, Z]], styles.edge);
  [-22, -15, -8].forEach((y, k) => s.line([[-54, y, Z], [[34, 22, 28][k], y, Z]], styles.fine));

  const [FL, FT, FR, FB] = [-40, 4, 42, 30];
  s.line(
    flat([
      [FL, FT],
      [FR, FT],
      [FR, FB],
      [FL, FB],
      [FL, FT],
    ]),
    styles.dash,
  );
  s.line([[FL + 4, FB - 4, Z], [FR - 4, FB - 4, Z]], styles.fine);
  s.group(anim(styles.flash), () =>
    s.face(
      flat([
        [-62, FT + 7],
        [-49, FT + 7],
        [-44, FT + 13],
        [-49, FT + 19],
        [-62, FT + 19],
      ]),
      styles.ring,
    ),
  );

  const [X0, CW, CH, CG, BG] = [-35, 2.6, 4.4, 0.8, 2.4];
  const cell = (x: number, y: number) =>
    s.face(
      flat([
        [x, y - CH / 2],
        [x + CW, y - CH / 2],
        [x + CW, y + CH / 2],
        [x, y + CH / 2],
      ]),
      styles.ink,
    );
  const ROWS = [
    { x: X0 + 2 * CW + CG + BG, y: 11.5, n: 7 },
    { x: X0, y: 20.5, n: 8 },
  ];
  const total = ROWS.reduce((sum, { n }) => sum + n, 0) + 1;
  const byte = (k: number, draw: () => void) =>
    s.group({ style: { "--t": round(k / total) } as CSSProperties }, draw);
  s.group({ className: styles.bytes }, () => {
    byte(0, () => {
      const [ox, oy] = [X0 + CW / 2, ROWS[0].y];
      s.face(
        Array.from({ length: 16 }, (_, i) => {
          const t = (i / 16) * 2 * Math.PI;
          return [ox + (CW / 2) * Math.cos(t), oy + (CH / 2) * Math.sin(t), Z] as const;
        }),
        styles.edge,
      );
      const xx = X0 + CW + CG;
      s.line([[xx, oy - CH / 2 + 1, Z], [xx + CW, oy + CH / 2, Z]], styles.edge);
      s.line([[xx + CW, oy - CH / 2 + 1, Z], [xx, oy + CH / 2, Z]], styles.edge);
    });
    let k = 1;
    for (const { x, y, n } of ROWS) {
      for (let b = 0; b < n; b++, k++) {
        const bx = x + b * (2 * CW + CG + BG);
        byte(k, () => {
          cell(bx, y);
          cell(bx + CW + CG, y);
        });
      }
    }
  });

  const [SX, SY, SZ] = [50, -30, Z + 18];
  const rim = 6 / Math.hypot(FR - SX, FT - SY);
  s.disc([SX, SY, Z], 6, styles.fine);
  s.group(anim(styles.flow), () => {
    s.line([[FR, FT, Z], [SX + (FR - SX) * rim, SY + (FT - SY) * rim, Z]], styles.dash);
    s.line([[SX, SY, Z], [SX, SY, SZ]], styles.edge);
  });
  s.disc([FR, FT, Z], 1.4, styles.ink);

  const SHIELD: Pt[] = [
    [-13, 32],
    [0, 37],
    [13, 32],
    [13, 17],
    [8, 7],
    [0, 0],
    [-8, 7],
    [-13, 17],
  ];
  const shield = (y: number): P3[] => SHIELD.map(([u, v]) => [SX + u, y, SZ + v]);
  const [front, back] = [shield(SY), shield(SY - 4)];
  front.forEach((p, i) => {
    const j = (i + 1) % front.length;
    s.face([p, front[j], back[j], back[i]], styles.sideR);
  });
  s.group({ className: styles.verify }, () => {
    s.face(front, styles.top);
    s.line(
      [
        [SX - 6, SY, SZ + 19],
        [SX - 1, SY, SZ + 13],
        [SX + 7, SY, SZ + 25],
      ],
      styles.edge,
    );
  });
}

/** A small ZODE cabin: centred on x, from y0 to y1 along its length, the glazed gable at y1 and +x the long glazed side. */
const CABIN = { x: 36, hw: 24, y0: -52, y1: 44, glass: 25, deck: 14 };

/** The gable's charcoal ring outline and its glass opening, as (across, up) from the centreline. */
const GABLE_OUT: Pt[] = [
  [24, 0],
  [24, 29],
  [23.3, 31.6],
  [21.3, 33.4],
  [3.8, 49.4],
  [2.2, 50],
  [-2.2, 50],
  [-3.8, 49.4],
  [-21.3, 33.4],
  [-23.3, 31.6],
  [-24, 29],
  [-24, 0],
];
const GABLE_IN: Pt[] = [
  [20.2, 3.8],
  [20.2, 27.6],
  [19.6, 29.6],
  [18.7, 30.6],
  [1.6, 46.2],
  [-1.6, 46.2],
  [-18.7, 30.6],
  [-19.6, 29.6],
  [-20.2, 27.6],
  [-20.2, 3.8],
];

/**
 * A ZODE cabin as the home page draws it, at icon scale: a glass box in a
 * charcoal ring frame with a flat crown and rounded eaves, posts and a dark
 * fascia along the glazed side, a deck off the glazed gable, its bolt flashing.
 */
function cabin(s: Sketch): void {
  const { x: CX, hw: HW, y0: Y0, y1: Y1, glass: GLASS, deck: DECK } = CABIN;
  const X1 = CX + HW;
  const INK = { top: styles.ink, sideL: styles.ink, sideR: styles.ink };
  const at =
    (y: number) =>
    ([u, z]: Pt): P3 => [CX + u, y, z];
  const side = (z0: number, z1: number, y0: number, y1: number, cls: string) =>
    s.face(
      [
        [X1, y0, z0],
        [X1, y1, z0],
        [X1, y1, z1],
        [X1, y0, z1],
      ],
      cls,
    );

  side(0, 3, Y0, Y1, styles.ink);
  side(3, GLASS, Y0, Y1, styles.top);
  for (let y = Y0 + 8; y < 6; y += 6) if (Math.abs(y + 22) > 3) side(3, 16, y, y + 4, styles.sideL);
  for (const [y, w] of [
    [Y0, 4],
    [-24, 2.5],
    [4, 2.5],
    [Y1 - 4, 4],
  ] as const)
    side(3, GLASS, y, y + w, styles.ink);
  side(GLASS, 29, Y0, Y1, styles.ink);

  const ROOF = GABLE_OUT.slice(1, -1);
  const BULLNOSE = 2;
  for (let i = ROOF.length - 2; i >= 0; i--) {
    const [a, b] = [ROOF[i], ROOF[i + 1]];
    s.face([at(Y0)(a), at(Y0)(b), at(Y1)(b), at(Y1)(a)], i < BULLNOSE ? styles.sideR : styles.top);
  }
  for (const y of [-20, 12]) s.line(ROOF.slice(BULLNOSE).map(at(y)));

  s.face(GABLE_OUT.map(at(Y1)), styles.ink);
  s.face(GABLE_IN.map(at(Y1)), styles.top);
  const slope = (u: number) => 46.2 - (Math.abs(u) - 1.6) * (15.6 / 17.1);
  for (const u of [-8, 8]) s.line([at(Y1)([u, 3.8]), at(Y1)([u, slope(u)])], styles.edge);
  s.line([at(Y1)([-20.2, 20]), at(Y1)([20.2, 20])], styles.edge);
  s.line([at(Y1)([0, 3.8]), at(Y1)([0, 20])], styles.edge);
  s.group(anim(styles.flash, 2), () => bolt(s, CX - 2, Y1, 23, 15));

  s.box(CX - HW, Y1, 2 * HW, DECK, 0, 1.5);
  s.box(CX - HW, Y1, 2, DECK, 0, 9, INK);
  s.face(
    [
      [CX - HW + 2, Y1 + DECK, 1.5],
      [X1 - 2, Y1 + DECK, 1.5],
      [X1 - 2, Y1 + DECK, 9],
      [CX - HW + 2, Y1 + DECK, 9],
    ],
    styles.fine,
  );
  s.box(X1 - 2, Y1, 2, DECK, 0, 9, INK);
}

/** Grid power secured: a lattice tower feeds a transformer beside a ZODE cabin, which lights up. */
function interconnect(s: Sketch): void {
  const [TX, TOP, ARM] = [-96, 100, 86];
  const half = (z: number) => 11 - (8 * z) / TOP;
  const LEVELS = [0, 18, 36, 54, 72, ARM];
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    const front = sx > 0 || sy > 0;
    s.line(
      [
        [TX + sx * half(0), sy * half(0), 0],
        [TX + sx * half(TOP), sy * half(TOP), TOP],
      ],
      front ? styles.edge : styles.fine,
    );
  }
  for (let k = 0; k < LEVELS.length - 1; k++) {
    const [z0, z1] = [LEVELS[k], LEVELS[k + 1]];
    const [w0, w1] = [half(z0), half(z1)];
    s.line([[TX + w0, -w0, z0], [TX + w1, w1, z1]]);
    s.line([[TX + w0, w0, z0], [TX + w1, -w1, z1]]);
    s.line([[TX - w0, w0, z0], [TX + w1, w1, z1]]);
    s.line([[TX + w0, w0, z0], [TX - w1, w1, z1]]);
    s.line([[TX + w1, -w1, z1], [TX + w1, w1, z1], [TX - w1, w1, z1]]);
  }
  s.box(TX - 1.5, -36, 3, 72, ARM, 3);
  const PHASES = [-30, 0, 30];
  for (const y of PHASES) insulator(s, TX, y, ARM - 12, ARM, 2);

  cabin(s);

  const [RX, RY, RW] = [-30, 32, 22];
  s.box(RX, RY, RW, RW, 0, 26);
  for (let x = RX + 4; x < RX + RW; x += 4) s.line([[x, RY + RW, 4], [x, RY + RW, 22]]);
  const BUSHINGS = [37, 43, 49];
  for (const y of BUSHINGS) insulator(s, RX + 11, y, 26, 36, 2);

  PHASES.forEach((y, k) =>
    s.group(anim(styles.flow, k), () =>
      s.line(span([TX, y, ARM - 12], [RX + 11, BUSHINGS[k], 36], 10), styles.edge),
    ),
  );
  s.group(anim(styles.flow), () =>
    s.line(
      [
        [RX + RW, 36, 1],
        [CABIN.x - CABIN.hw, 36, 1],
      ],
      styles.edge,
    ),
  );
}

/**
 * A liquid-cooled GPU rack at (x, y), its front (+x) ruled into GPU trays,
 * each with a status light, under a top-of-rack switch, a coolant riser at its side.
 */
function gpuRack(s: Sketch, x: number, y: number, w: number, d: number, h: number, k: number): void {
  const X = x + w;
  s.group(anim(styles.shade, k), () => s.box(x, y, w, d, 0, h));
  s.face(
    [
      [X, y + 2, h - 9],
      [X, y + d - 2, h - 9],
      [X, y + d - 2, h - 3],
      [X, y + 2, h - 3],
    ],
    styles.fine,
  );
  for (let py = y + 4; py < y + d - 2; py += 3) s.line([[X, py, h - 6], [X, py + 1.2, h - 6]], styles.edge);
  for (let z = 6; z < h - 10; z += 5) {
    s.line([[X, y + 2, z], [X, y + d - 2, z]]);
    s.group(anim(styles.flash, k + z / 5), () => circle(s, ...project([X, y + d - 4, z + 2.5]), 0.9, styles.ring));
  }
  s.line([[X, y + 1, 3], [X, y + 1, h - 1]], styles.edge);
}

/** One SPV per cluster: prepayment, GPU debt and preferred equity stack up inside its boundary and fund the GPU racks. */
function capitalStack(s: Sketch): void {
  s.box(-84, -60, 148, 108, -4, 4);
  s.group(anim(styles.flow), () =>
    s.line(
      [
        [-74, -50],
        [54, -50],
        [54, 38],
        [-74, 38],
        [-74, -50],
      ],
      styles.dash,
    ),
  );

  const [CX, CY] = [-46, 6];
  const TRANCHES = [
    [24, 0, 14],
    [19, 14, 22],
    [12, 36, 10],
  ] as const;
  TRANCHES.forEach(([r, z, h], k) =>
    s.group(anim(styles.flow, k), () => s.line([[CX, -84, z + h / 2], [CX, CY - r, z + h / 2]], styles.edge)),
  );

  const [RX, RW, RD, RH] = [24, 22, 18, 58];
  const RACKS = [-46, -26, -6];
  s.group(anim(styles.flow, 3), () => {
    s.line(
      [
        [CX + 24, CY, 1],
        [12, CY, 1],
        [12, RACKS[0] + RD / 2, 1],
      ],
      styles.edge,
    );
    for (const y of RACKS) s.line([[12, y + RD / 2, 1], [RX, y + RD / 2, 1]], styles.edge);
  });

  TRANCHES.forEach(([r, z, h], k) =>
    s.group(anim(styles.shade, k * 2), () => {
      s.box(CX - r, CY - r, 2 * r, 2 * r, z, h);
      s.line(
        [
          [CX - r + 4, CY + r, z + h / 2],
          [CX + r, CY + r, z + h / 2],
          [CX + r, CY - r + 4, z + h / 2],
        ],
        styles.fine,
      );
    }),
  );

  RACKS.forEach((y, k) => gpuRack(s, RX, y, RW, RD, RH, k));
  const MX = RX + 6;
  for (const y of RACKS) s.line([[MX + 1.5, y + RD / 2, RH], [MX + 1.5, y + RD / 2, RH + 5]], styles.edge);
  s.box(MX, RACKS[0] + 2, 3, RACKS[2] - RACKS[0] + RD - 4, RH + 5, 3);
}

/** An SVG motion path through model points, in screen space. */
const motion = (ps: readonly P3[]) =>
  `M ${ps
    .map((p) => project(p))
    .map(([x, y]) => `${x} ${y}`)
    .join(" L ")}`;

/** One rider looping along `path`, drawn by `draw` at the origin; an `extra` one shows only while the card is hovered. */
function rider(s: Sketch, path: string, dur: number, begin: number, extra: boolean, draw: () => void): void {
  s.group({ className: extra ? `${styles.rider} ${styles.extra}` : styles.rider }, () => {
    s.el("animateMotion", {
      path,
      dur: `${round(dur)}s`,
      begin: `${round(begin)}s`,
      repeatCount: "indefinite",
      calcMode: "paced",
    });
    draw();
  });
}

/** `n` riders spaced evenly along `path`, every other one extra. */
function riders(s: Sketch, path: string, dur: number, n: number, draw: () => void): void {
  for (let k = 0; k < n; k++) rider(s, path, dur, (-k * dur) / n, k % 2 === 1, draw);
}

/** Centres of the die's compute tiles, `TILE` across, a channel between each. */
const TILE_X = [-44, -22, 0, 22, 44];
const TILE_Y = [-22, 0, 22];
const TILE = 14;

/**
 * Tokens made like an advanced chip on a line: energy rides the feed rail in
 * on the left onto the die's power bus, its grid of compute tiles fires in
 * waves from input to output with pulses hopping tile to tile along the
 * channels, and the tokens leave on the right as coins down the conveyor.
 */
function tokenMaze(s: Sketch): void {
  const TOP = 10;
  const random = rng(7);

  s.box(-96, -66, 192, 132, 0, 4);
  for (let x = -88; x <= 84; x += 16) s.box(x, 66, 4, 2, 1, 2);
  for (let y = -58; y <= 56; y += 16) if (y < -46 || y > -28) s.box(96, y, 2, 4, 1, 2);
  s.box(-74, -50, 148, 100, 4, 3);
  for (let k = 0; k < 4; k++) {
    const x = -58 + k * 30;
    s.group(anim(styles.shade, k), () => s.box(x, 41, 20, 7, 7, 8));
    for (const z of [9, 11, 13]) s.line([[x + 1, 48, z], [x + 19, 48, z]]);
  }
  s.box(-62, -40, 124, 80, 7, TOP - 7);
  s.line(
    [
      [-59, -37, TOP],
      [59, -37, TOP],
      [59, 37, TOP],
      [-59, 37, TOP],
      [-59, -37, TOP],
    ],
    styles.fine,
  );

  const half = TILE / 2;
  const lane = (TILE_X[1] - TILE_X[0]) / 2;
  for (const x of TILE_X.slice(1)) s.line([[x - lane, -37, TOP], [x - lane, 37, TOP]]);
  for (const y of TILE_Y.slice(1)) s.line([[-59, y - lane, TOP], [59, y - lane, TOP]]);

  const BUS_X = -56;
  const FEED: P3[] = [
    [-124, 33, TOP],
    [-62, 33, TOP],
    [BUS_X, 33, TOP],
    [BUS_X, TILE_Y[0], TOP],
  ];
  s.line(FEED.slice(1), styles.edge);
  for (const y of TILE_Y) s.line([[BUS_X, y, TOP], [TILE_X[0] - half, y, TOP]], styles.edge);

  const OUT_X = 55;
  const LAST = TILE_X[TILE_X.length - 1];
  const exits = TILE_Y.map((y): P3[] => [
    [LAST + half, y, TOP],
    [OUT_X, y, TOP],
    [OUT_X, -37, TOP],
    [62, -37, TOP],
  ]);
  for (const route of exits) s.line(route, styles.edge);
  const OUT: P3[] = [
    [62, -37, TOP],
    [134, -37, TOP],
  ];

  const square = (x: number, y: number, r: number, className: string) =>
    s.face(
      [
        [x - r, y - r, TOP],
        [x + r, y - r, TOP],
        [x + r, y + r, TOP],
        [x - r, y + r, TOP],
      ],
      className,
    );
  TILE_X.forEach((x, c) =>
    TILE_Y.forEach((y) => {
      square(x, y, half, styles.sideL);
      s.group(anim(styles.flash, c + Math.floor(random() * 2) / 2), () => square(x, y, 3.5, styles.ring));
    }),
  );

  s.box(-124, 28, 62, 10, 0, TOP);
  for (let x = -120; x < -62; x += 6) s.line([[x, 28, TOP], [x, 38, TOP]]);
  s.group(anim(styles.flash), () => bolt(s, -134, 33, TOP, 26));

  s.box(62, -42, 72, 10, 0, TOP);
  for (let x = 66; x < 134; x += 6) s.line([[x, -42, TOP], [x, -32, TOP]]);
  for (let x = 70; x < 134; x += 24) s.line([[x, -32, 2], [x, -32, TOP - 2]], styles.edge);

  const spark = () => s.disc([0, 0, 0], 1.5, styles.ink);
  riders(s, motion(FEED), 3, 8, spark);
  for (let k = 0; k < 28; k++) {
    const c = Math.floor(random() * (TILE_X.length - 1));
    const r = Math.floor(random() * TILE_Y.length);
    const to = Math.min(TILE_Y.length - 1, Math.max(0, r + Math.floor(random() * 3) - 1));
    const [x0, x1, y0, y1] = [TILE_X[c], TILE_X[c + 1], TILE_Y[r], TILE_Y[to]];
    const hop: P3[] = [
      [x0, y0, TOP],
      [x0 + lane, y0, TOP],
      [x0 + lane, y1, TOP],
      [x1, y1, TOP],
    ];
    const dur = 0.7 + 0.5 * random();
    rider(s, motion(hop), dur, -random() * dur, k % 2 === 1, spark);
  }
  for (const route of exits) riders(s, motion(route), 1.6, 4, spark);
  riders(s, motion(OUT), 3.5, 8, () => coins(s, 0, 0, 3.8, 1, 2.2));
}

const DRAW: Record<MacroArtId, (s: Sketch) => void> = {
  capital,
  power,
  compute,
  land,
  datacenter,
  offtake,
  vacancy,
  construction,
  absorption,
  regulation,
  localBuild,
  supplyChain,
  financing,
  monolith,
  water,
  powerBill,
  economics,
  signature,
  interconnect,
  capitalStack,
  tokenMaze,
};

/** Each drawing fits its own frame: the cards are small, so legibility wins over a shared scale. */
const ART = Object.fromEntries(
  Object.entries(DRAW).map(([id, draw]) => {
    const s = new Sketch(styles);
    draw(s);
    return [id, { items: s.items, view: s.bounds(6) }];
  }),
) as Record<MacroArtId, { items: ReactElement[]; view: Bounds }>;

/**
 * A line drawing for the macro slides, drawn for the ink ground unless
 * `light`. `hard` sets it in red, for the bottleneck; `playing` loops its
 * animation.
 */
export function MacroArt({
  id,
  hard = false,
  light = false,
  playing = false,
}: {
  id: MacroArtId;
  hard?: boolean;
  light?: boolean;
  playing?: boolean;
}): ReactElement {
  const { items, view } = ART[id];
  return (
    <svg
      className={styles.art}
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      data-hard={hard || undefined}
      data-light={light || undefined}
      data-playing={playing || undefined}
      aria-hidden="true"
    >
      {items}
    </svg>
  );
}
