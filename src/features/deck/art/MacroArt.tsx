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

/** A lattice pylon: the lines arrive solid on the left and leave dashed on the right, short of supply. */
function power(s: Sketch): void {
  const [BASE, TOP, BW, TW] = [64, -92, 36, 9];
  const leg = (y: number) => BW + ((TW - BW) * (BASE - y)) / (BASE - TOP);
  const levels = [64, 30, 0, -26, -50, -72, -92];

  seg(s, -70, BASE, 70, BASE, styles.fine);
  seg(s, -leg(BASE), BASE, -TW, TOP, styles.edge);
  seg(s, leg(BASE), BASE, TW, TOP, styles.edge);
  for (let k = 0; k < levels.length - 1; k++) {
    const [y0, y1] = [levels[k], levels[k + 1]];
    seg(s, -leg(y0), y0, leg(y1), y1, styles.fine);
    seg(s, leg(y0), y0, -leg(y1), y1, styles.fine);
    seg(s, -leg(y1), y1, leg(y1), y1, styles.fine);
  }
  poly(
    s,
    [
      [-TW, TOP],
      [0, TOP - 16],
      [TW, TOP],
    ],
    styles.top,
  );

  const arms = [
    [-72, 64],
    [-50, 52],
  ] as const;
  arms.forEach(([y, reach], k) => {
    poly(
      s,
      [
        [-reach, y],
        [reach, y],
        [leg(y), y + 6],
        [-leg(y), y + 6],
      ],
      styles.top,
    );
    for (const side of [-1, 1]) {
      const x = side * (reach - 4);
      const drop = y + 12;
      seg(s, x, y, x, drop, styles.edge);
      circle(s, x, drop, 2.2, styles.ring);
      const end = side * 160;
      const d = `M ${round(x)} ${round(drop)} Q ${round((x + end) / 2)} ${round(drop + 24)} ${end} ${round(drop + 6)}`;
      s.extend(end, drop + 6);
      s.extend((x + end) / 2, drop + 14);
      if (side < 0) s.group(anim(styles.flow, k), () => s.path(d, styles.edge));
      else s.path(d, styles.dash);
    }
  });
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
 * A line drawing for the macro slide, drawn for the ink ground. `hard` sets
 * it in red, for the bottleneck; `playing` loops its animation.
 */
export function MacroArt({
  id,
  hard = false,
  playing = false,
}: {
  id: MacroArtId;
  hard?: boolean;
  playing?: boolean;
}): ReactElement {
  const { items, view } = ART[id];
  return (
    <svg
      className={styles.art}
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      data-hard={hard || undefined}
      data-playing={playing || undefined}
      aria-hidden="true"
    >
      {items}
    </svg>
  );
}
