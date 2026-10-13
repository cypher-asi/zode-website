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

const DRAW: Record<MacroArtId, (s: Sketch) => void> = { capital, power, compute, land, datacenter, offtake };

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
