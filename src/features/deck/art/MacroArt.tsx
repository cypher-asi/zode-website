import type { CSSProperties, ReactElement } from "react";
import { Sketch, project, round, type Bounds, type P3 } from "@/features/zode-drawings/lineArt";
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
