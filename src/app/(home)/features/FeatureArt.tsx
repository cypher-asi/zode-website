import type { CSSProperties, ReactElement } from "react";
import { Sketch, project, round, type Bounds } from "../lineart";
import { FEATURES, type FeatureId } from "./features";
import styles from "./Features.module.css";

/** Annotation size, in viewBox units (see `.note`). */
const FONT = 9;

const GHOST = { top: styles.ghost, sideL: styles.ghost, sideR: styles.ghost };

function note(s: Sketch, x: number, y: number, text: string, anchor: "start" | "middle" | "end" = "middle"): void {
  const w = text.length * FONT * 0.62;
  const left = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
  s.extend(left + w / 2, y - FONT * 0.35, w / 2, FONT / 2);
  s.el("text", { x: round(x), y: round(y), className: styles.note, textAnchor: anchor, children: text });
}

function rect(s: Sketch, x: number, y: number, w: number, h: number, className: string): void {
  s.extend(x + w / 2, y + h / 2, w / 2, h / 2);
  s.el("rect", { x: round(x), y: round(y), width: round(w), height: round(h), className });
}

function circle(s: Sketch, cx: number, cy: number, r: number, className: string): void {
  s.extend(cx, cy, r);
  s.el("circle", { cx: round(cx), cy: round(cy), r: round(r), className });
}

function seg(s: Sketch, x1: number, y1: number, x2: number, y2: number, className: string): void {
  s.extend(x1, y1);
  s.extend(x2, y2);
  s.el("line", { x1: round(x1), y1: round(y1), x2: round(x2), y2: round(y2), className });
}

/** Point `r` from (cx, cy) at angle `a`. */
const polar = (cx: number, cy: number, r: number, a: number): [number, number] => [
  cx + r * Math.cos(a),
  cy + r * Math.sin(a),
];

function sun(s: Sketch, cx: number, cy: number): void {
  circle(s, cx, cy, 4.5, styles.ring);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    seg(s, ...polar(cx, cy, 7, a), ...polar(cx, cy, 10, a), styles.edge);
  }
}

function snowflake(s: Sketch, cx: number, cy: number): void {
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 - Math.PI / 2;
    seg(s, cx, cy, ...polar(cx, cy, 9, a), styles.edge);
    const [bx, by] = polar(cx, cy, 5.5, a);
    for (const turn of [-0.8, 0.8]) seg(s, bx, by, ...polar(bx, by, 3, a + turn), styles.edge);
  }
}

/** A factory-built pod on a trailer over a 13-week, 90-day ruler. */
function rapid(s: Sketch): void {
  for (const [y, z, len] of [
    [18, 72, 34],
    [24, 52, 50],
    [20, 34, 24],
  ] as const) {
    s.line([[-108 - len, y, z], [-108, y, z]], styles.dash);
  }

  s.box(-104, -24, 216, 48, 12, 8);
  s.line([[74, 24, 12], [74, 24, 3]], styles.edge);
  s.box(70, 20, 8, 8, 0, 3);
  for (const x of [-80, -56]) {
    s.wheel([x, 27, 10], 10, "xz", styles.ring);
    s.wheel([x, 27, 10], 3.5, "xz", styles.ring);
  }

  s.box(-100, -28, 200, 56, 20, 64);
  for (let x = -92; x <= 92; x += 8) s.line([[x, 28, 24], [x, 28, 80]]);
  s.line([[-100, 28, 24], [100, 28, 24]]);
  s.line([[-100, 28, 80], [100, 28, 80]]);
  s.face(
    [
      [100, -25, 23],
      [100, 25, 23],
      [100, 25, 81],
      [100, -25, 81],
    ],
    styles.fine,
  );
  s.line([[100, 0, 23], [100, 0, 81]], styles.edge);
  for (const y of [-17, -8, 8, 17]) s.line([[100, y, 26], [100, y, 78]]);

  const Y = 58;
  s.line([[-100, Y], [100, Y]], styles.edge);
  for (let k = 0; k <= 13; k++) {
    const x = -100 + (200 * k) / 13;
    const end = k === 0 || k === 13;
    s.line([[x, Y], [x, Y + (end ? 10 : 5)]], end ? styles.edge : styles.fine);
  }
  s.disc([100, Y], 2.2, styles.ink);
  const [ax, ay] = project([-100, Y + 14]);
  note(s, ax, ay + FONT, "DAY 0");
  const [bx, by] = project([100, Y + 14]);
  note(s, bx, by + FONT, "DAY 90");
}

/** N cooling units plus a dashed standby unit, each fed from both A and B buses. */
function redundant(s: Sketch): void {
  const [W, D, H, P, N] = [36, 44, 56, 46, 4];
  const A = 40;
  const B = 58;
  const x0 = (k: number) => -112 + k * P;

  for (let k = 0; k <= N; k++) {
    const ghost = k === N;
    const x = x0(k);
    const cx = x + W / 2;
    s.box(x, -D / 2, W, D, 0, H, ghost ? GHOST : s.cls);
    if (!ghost) for (let z = 10; z <= 44; z += 6) s.line([[x + 5, D / 2, z], [x + W - 5, D / 2, z]]);
    s.disc([cx, 0, H], 12, ghost ? styles.ghost : styles.ring);
    for (let b = 0; b < 4; b++) {
      const a = (b / 4) * Math.PI * 2 + 0.4;
      s.line([[cx, 0, H], [cx + 10 * Math.cos(a), 10 * Math.sin(a), H]], ghost ? styles.dash : styles.fine);
    }
    s.disc([cx, 0, H], 2.6, ghost ? styles.ring : styles.ink);
  }

  s.line([[-126, A], [104, A]], styles.edge);
  s.line([[-126, B], [104, B]], styles.edge);
  for (let k = 0; k <= N; k++) {
    const ghost = k === N;
    const cx = x0(k) + W / 2;
    s.line([[cx, D / 2], [cx, B]], ghost ? styles.dash : styles.edge);
    for (const y of [A, B]) s.disc([cx, y], 1.8, ghost ? styles.ring : styles.ink);
  }
  const [lax, lay] = project([-126, A]);
  note(s, lax - 6, lay + 3, "A", "end");
  const [lbx, lby] = project([-126, B]);
  note(s, lbx - 6, lby + 3, "B", "end");

  const bracket = (from: number, to: number, label: string) => {
    const z = H + 16;
    s.line(
      [
        [from, -D / 2, z - 6],
        [from, -D / 2, z],
        [to, -D / 2, z],
        [to, -D / 2, z - 6],
      ],
      styles.fine,
    );
    const [tx, ty] = project([(from + to) / 2, -D / 2, z]);
    note(s, tx, ty - 5, label);
  };
  bracket(x0(0), x0(N - 1) + W, "N");
  bracket(x0(N), x0(N) + W, "+1");
}

/** A sealed, louvred enclosure beside a -40 to 115 °F operating scale. */
function weather(s: Sketch): void {
  s.box(-64, -49, 128, 98, -6, 6);
  s.box(-60, -45, 120, 90, 0, 90);

  s.face(
    [
      [-50, 45, 14],
      [50, 45, 14],
      [50, 45, 76],
      [-50, 45, 76],
    ],
    styles.fine,
  );
  for (const z of [72, 60, 48, 36, 24]) {
    s.face(
      [
        [-46, 45, z],
        [46, 45, z],
        [46, 50, z - 5],
        [-46, 50, z - 5],
      ],
      styles.top,
    );
  }

  for (const k of [7, 10]) {
    s.face(
      [
        [60, -45 + k, k - 1],
        [60, 45 - k, k - 1],
        [60, 45 - k, 91 - k],
        [60, -45 + k, 91 - k],
      ],
      styles.fine,
    );
  }
  for (const z of [16, 72]) s.line([[60, -38, z - 4], [60, -38, z + 4]], styles.edge);
  s.line([[60, 29, 40], [60, 29, 54]], styles.edge);

  s.box(-66, -51, 132, 102, 90, 6);

  const X = -150;
  const top = -128;
  const bottom = 48;
  const at = (t: number) => bottom - ((t + 40) / 155) * (bottom - top);
  seg(s, X, at(115), X, at(-40), styles.edge);
  for (let t = -40; t <= 115; t += 5) {
    const major = t % 25 === 0 || t === -40 || t === 115;
    seg(s, X, at(t), X + (major ? 8 : 4), at(t), major ? styles.edge : styles.fine);
  }
  note(s, X - 6, at(115) + 3, "115°F", "end");
  note(s, X - 6, at(32) + 3, "32°F", "end");
  note(s, X - 6, at(-40) + 3, "−40°F", "end");
  sun(s, X, at(115) - 18);
  snowflake(s, X, at(-40) + 18);
}

type RackRow = "power" | "compute" | "switch";

const RACK: readonly RackRow[] = [
  ...Array<RackRow>(2).fill("power"),
  ...Array<RackRow>(10).fill("compute"),
  ...Array<RackRow>(9).fill("switch"),
  ...Array<RackRow>(8).fill("compute"),
  ...Array<RackRow>(2).fill("power"),
];

const ROW_HEIGHT: Record<RackRow, number> = { power: 8, compute: 7, switch: 4 };

/** Front elevation of a reference rack with a magnified connector detail. */
function nvidia(s: Sketch): void {
  const [RX, RY, RW, RH] = [-150, -120, 100, 240];
  const CX = RX + RW / 2;

  seg(s, CX, RY - 14, CX, RY + RH + 16, styles.center);
  rect(s, RX + 2, RY + RH, 12, 5, styles.sideR);
  rect(s, RX + RW - 14, RY + RH, 12, 5, styles.sideR);
  rect(s, RX, RY, RW, RH, styles.top);
  rect(s, RX + 7, RY + 7, RW - 14, RH - 14, styles.fine);

  const used = RACK.reduce((sum, row) => sum + ROW_HEIGHT[row], 0);
  const gap = (RH - 14 - used) / (RACK.length + 1);
  const x0 = RX + 9;
  const w = RW - 18;
  let y = RY + 7 + gap;
  let switchTop = 0;
  let switchBottom = 0;
  for (const row of RACK) {
    const h = ROW_HEIGHT[row];
    if (row === "compute") {
      rect(s, x0, y, w, h, styles.sideL);
      rect(s, x0 + 3, y + 1.5, 8, h - 3, styles.fine);
      for (let vx = x0 + 40; vx <= x0 + w - 4; vx += 3.5) seg(s, vx, y + 1.5, vx, y + h - 1.5, styles.fine);
    } else if (row === "switch") {
      if (!switchTop) switchTop = y;
      switchBottom = y + h;
      rect(s, x0, y, w, h, styles.sideR);
      for (let px = x0 + 4; px + 3 <= x0 + w - 4; px += 5) rect(s, px, y + 1, 3, h - 2, styles.ink);
    } else {
      rect(s, x0, y, w, h, styles.top);
      for (let i = 0; i < 6; i++) circle(s, x0 + 8 + i * 13.2, y + h / 2, 2.4, styles.ring);
    }
    y += h + gap;
  }

  const mid = (switchTop + switchBottom) / 2;
  const callX = RX + RW - 24;
  const callR = 14;
  const [DX, DY, R] = [78, mid, 72];
  circle(s, callX, mid, callR, styles.halo);
  circle(s, callX, mid, callR, styles.dash);
  note(s, RX + RW + 5, mid - 5, "A", "start");
  seg(s, callX + callR, mid, DX - R, DY, styles.fine);

  circle(s, DX, DY, R, styles.dash);
  circle(s, DX, DY, 56, styles.ring);
  circle(s, DX, DY, 46, styles.fine);
  rect(s, DX - 4, DY - 49, 8, 6, styles.top);
  for (let k = 0; k < 4; k++) circle(s, ...polar(DX, DY, 51, Math.PI / 4 + (k * Math.PI) / 2), 2.6, styles.ring);

  const HR = 34;
  circle(s, DX, DY, HR, styles.ring);
  for (let c = -HR * Math.SQRT2 + 4; c < HR * Math.SQRT2; c += 5) {
    const half = Math.sqrt(HR * HR - (c * c) / 2) / Math.SQRT2;
    seg(s, DX + c / 2 - half, DY + c / 2 + half, DX + c / 2 + half, DY + c / 2 - half, styles.fine);
  }
  circle(s, DX, DY, HR, styles.edge);
  const pins: [number, number][] = [[DX, DY]];
  for (let k = 0; k < 6; k++) pins.push(polar(DX, DY, 20, (k / 6) * Math.PI * 2 - Math.PI / 2));
  for (const [px, py] of pins) {
    circle(s, px, py, 6, styles.ring);
    circle(s, px, py, 1.4, styles.ink);
  }

  seg(s, DX - 64, DY, DX + 64, DY, styles.center);
  seg(s, DX, DY - 64, DX, DY + 64, styles.center);
  note(s, DX, DY + R + 16, "DETAIL A");
}

/** Power, cooling, and network feeding a GPU package that streams tokens out. */
function tokens(s: Sketch): void {
  for (const [label, y] of [
    ["PWR", -36],
    ["COOL", 0],
    ["NET", 36],
  ] as const) {
    s.line([[-130, y], [-90, y]], styles.edge);
    s.disc([-130, y], 2.2, styles.ring);
    const [lx, ly] = project([-136, y]);
    note(s, lx - 2, ly + 3, label, "end");
  }

  s.box(-90, -70, 180, 140, 0, 6);
  s.line([[58, 0, 6], [90, 0, 6], [90, 0, 0], [96, 0, 0]], styles.edge);
  s.box(-58, -48, 116, 96, 6, 3);

  const hbm = (x: number) => {
    for (const y of [-42, -20, 2, 24]) {
      const [x1, y1] = [x + 22, y + 18];
      s.box(x, y, 22, 18, 9, 9);
      for (const z of [11.25, 13.5, 15.75]) s.line([[x1, y, z], [x1, y1, z], [x, y1, z]]);
    }
  };
  hbm(-53);
  for (const x of [-27, 2]) {
    s.box(x, -40, 25, 80, 9, 7);
    s.face(
      [
        [x + 3, -37, 16],
        [x + 22, -37, 16],
        [x + 22, 37, 16],
        [x + 3, 37, 16],
      ],
      styles.fine,
    );
  }
  hbm(31);

  for (let y = -62; y <= 46; y += 12) if (y + 6 < -3 || y > 3) s.box(80, y, 4, 6, 6, 2.5);
  for (let x = -80; x <= 76; x += 12) s.box(x, 58, 6, 4, 6, 2.5);

  for (let i = 0; i < 4; i++) {
    s.group({ className: styles.token, style: { "--t": i } as CSSProperties }, () =>
      s.box(98 + i * 14, -4, 8, 8, 0, 8),
    );
  }
}

const DRAW: Record<FeatureId, (s: Sketch) => void> = { rapid, redundant, weather, nvidia, tokens };

const ART = Object.fromEntries(
  FEATURES.map(({ id }) => {
    const s = new Sketch(styles);
    DRAW[id](s);
    return [id, { items: s.items, view: s.bounds(8) }];
  }),
) as Record<FeatureId, { items: ReactElement[]; view: Bounds }>;

/** Line drawing for one feature, sized so every figure shares the same scale. */
export function FeatureArt({ id }: { id: FeatureId }): ReactElement {
  const { items, view } = ART[id];
  return (
    <svg
      className={styles.art}
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      style={{ "--w": view.w } as CSSProperties}
      aria-hidden="true"
    >
      {items}
    </svg>
  );
}
