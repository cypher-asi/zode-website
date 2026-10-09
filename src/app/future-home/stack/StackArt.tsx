import type { CSSProperties, ReactElement } from "react";
import { LAYERS, type LayerId } from "./layers";
import styles from "./FullStack.module.css";

/** Half a plate's side length, in plane units. */
const H = 90;
const PLATE = 8;
const BASE = 24;
/** Exploded spacing between plates, in viewBox units. */
const GAP = 96;
const MID = (LAYERS.length - 1) / 2;

export const VIEW = { x: -184, y: -364, w: 368, h: 728 };

/** Exploded viewBox y a layer's label lines up with: just below the plate's centre, where its front shows. */
export function labelY(index: number): number {
  return (index - MID) * GAP + 40;
}

type P3 = readonly [number, number, number?];

const round = (n: number) => Math.round(n * 100) / 100;

/** 2:1 dimetric projection; +z is up, +x/+y run toward the viewer's right/left. */
function project([x, y, z = 0]: P3): [number, number] {
  return [round(x - y), round((x + y) / 2 - z)];
}

const toPoints = (ps: readonly P3[]) => ps.map((p) => project(p).join(",")).join(" ");

/** Deterministic PRNG so the server and client render identical geometry. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Collects SVG elements in paint order. */
class Sketch {
  readonly items: ReactElement[] = [];

  face(ps: readonly P3[], className: string): void {
    this.items.push(<polygon key={this.items.length} className={className} points={toPoints(ps)} />);
  }

  line(ps: readonly P3[], className: string = styles.fine): void {
    this.items.push(<polyline key={this.items.length} className={className} points={toPoints(ps)} />);
  }

  path(d: string, className: string = styles.fine): void {
    this.items.push(<path key={this.items.length} className={className} d={d} />);
  }

  /** A circle of radius `r` lying flat at `p`. */
  disc(p: P3, r: number, className: string): void {
    const [cx, cy] = project(p);
    const rx = round(r * Math.SQRT2);
    this.items.push(
      <ellipse key={this.items.length} className={className} cx={cx} cy={cy} rx={rx} ry={round(rx / 2)} />,
    );
  }

  /** Axis-aligned box; only the three faces turned toward the viewer are drawn. */
  box(x0: number, y0: number, w: number, d: number, z0: number, h: number): void {
    const [x1, y1, z1] = [x0 + w, y0 + d, z0 + h];
    this.face(
      [
        [x1, y0, z0],
        [x1, y1, z0],
        [x1, y1, z1],
        [x1, y0, z1],
      ],
      styles.sideR,
    );
    this.face(
      [
        [x0, y1, z0],
        [x1, y1, z0],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
      styles.sideL,
    );
    this.face(
      [
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
      styles.top,
    );
  }

  slab(thickness: number): void {
    this.box(-H, -H, 2 * H, 2 * H, -thickness, thickness);
  }

  /** Square outline inset on the plate's top face. */
  inset(k: number, z = 0): void {
    this.face(
      [
        [-k, -k, z],
        [k, -k, z],
        [k, k, z],
        [-k, k, z],
      ],
      styles.fine,
    );
  }
}

const backToFront = <T extends { x: number; y: number }>(a: T, b: T) => a.x + a.y - (b.x + b.y);

function network(s: Sketch): void {
  s.slab(PLATE);
  s.inset(H - 7);

  const rand = rng(7);
  const n = 6;
  const step = 28;
  const nodes = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => ({
      x: -70 + i * step + (rand() - 0.5) * 12,
      y: -70 + j * step + (rand() - 0.5) * 12,
      hub: rand() < 0.16,
    })),
  );

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const a = nodes[i][j];
      const next = [i + 1 < n && nodes[i + 1][j], j + 1 < n && nodes[i][j + 1]];
      if (i + 1 < n && j + 1 < n && rand() < 0.3) next.push(nodes[i + 1][j + 1]);
      for (const b of next) if (b) s.line([[a.x, a.y], [b.x, b.y]]);
    }
  }

  const all = nodes.flat().sort(backToFront);
  for (const p of all) if (!p.hub) s.disc([p.x, p.y], 1.8, styles.ink);
  for (const p of all) {
    if (!p.hub) continue;
    s.disc([p.x, p.y], 4.2, styles.ring);
    s.line([[p.x, p.y, 0], [p.x, p.y, 16]], styles.edge);
    s.disc([p.x, p.y, 16], 1.8, styles.ink);
  }

  s.face(
    [
      [-76, 64],
      [-64, 64],
      [-70, 76],
    ],
    styles.edge,
  );
  s.disc([72, -72], 4, styles.ring);
}

function routing(s: Sketch): void {
  s.slab(PLATE);

  // Fan-out centred toward the front so it shows below the plate above.
  const c = 12;
  const turns: ((x: number, y: number) => P3)[] = [
    (x, y) => [c + x, c + y],
    (x, y) => [c - y, c + x],
    (x, y) => [c - x, c - y],
    (x, y) => [c + y, c - x],
  ];
  for (const turn of turns) {
    for (let j = -4; j <= 4; j++) {
      const a = j * 3.5;
      const b = j * 11;
      s.line([turn(17, a), turn(26, a), turn(26 + Math.abs(b - a), b), turn(63, b)]);
      s.disc(turn(66, b), 1.5, styles.ink);
    }
  }

  s.box(c - 16, c - 16, 32, 32, 0, 5);
  for (let x = -9; x <= 9; x += 6) {
    for (let y = -9; y <= 9; y += 6) s.disc([c + x, c + y, 5], 1, styles.ink);
  }
}

function compute(s: Sketch): void {
  s.slab(PLATE);
  s.inset(H - 7);

  const size = 16;
  const pitch = 24;
  const cells: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) cells.push({ x: -68 + i * pitch, y: -68 + j * pitch });
  }
  for (const c of cells.sort(backToFront)) {
    s.box(c.x, c.y, size, size, 0, 6);
    s.face(
      [
        [c.x + 4, c.y + 4, 6],
        [c.x + size - 4, c.y + 4, 6],
        [c.x + size - 4, c.y + size - 4, 6],
        [c.x + 4, c.y + size - 4, 6],
      ],
      styles.fine,
    );
  }
}

function pods(s: Sketch): void {
  s.slab(PLATE);

  const w = 72;
  const d = 24;
  const h = 18;
  const units: { x: number; y: number }[] = [];
  for (const x of [-78, 6]) {
    for (let k = 0; k < 4; k++) units.push({ x, y: -69 + k * 38 });
  }
  for (const { x, y } of units.sort(backToFront)) {
    const [x1, y1] = [x + w, y + d];
    s.box(x, y, w, d, 0, h);
    for (let rx = x + 6; rx < x1 - 3; rx += 6) s.line([[rx, y1, 2], [rx, y1, h - 2]]);
    s.line(
      [
        [x1, y + 8, 0],
        [x1, y + 8, 12],
        [x1, y + 16, 12],
        [x1, y + 16, 0],
      ],
      styles.edge,
    );
    s.line([[x + 4, y + d / 2, h], [x1 - 4, y + d / 2, h]]);
  }
}

function power(s: Sketch): void {
  s.slab(PLATE);

  const cells: { x: number; y: number }[] = [];
  for (const y of [-80, -56]) {
    for (let c = 0; c < 7; c++) cells.push({ x: -78 + c * 23, y });
  }
  for (const { x, y } of cells.sort(backToFront)) {
    s.box(x, y, 18, 16, 0, 14);
    s.line([[x, y + 16, 10], [x + 18, y + 16, 10], [x + 18, y, 10]]);
    s.line([[x + 5, y + 8, 14], [x + 5, y + 8, 16]], styles.edge);
  }

  for (let k = 0; k < 6; k++) {
    const y = -28 + k * 18;
    s.face(
      [
        [-78, y, 9],
        [78, y, 9],
        [78, y + 12, 3],
        [-78, y + 12, 3],
      ],
      styles.top,
    );
    for (let x = -65; x < 78; x += 13) s.line([[x, y, 9], [x, y + 12, 3]]);
    s.line([[-78, y + 6, 6], [78, y + 6, 6]]);
  }
}

function land(s: Sketch): void {
  s.slab(BASE);

  for (const z of [-7, -13, -19]) s.line([[H, -H, z], [H, H, z], [-H, H, z]]);

  const limit = H - 4;
  for (let r = 12; r <= 96; r += 12) {
    let d = "";
    let pen = false;
    let closed = true;
    for (let k = 0; k <= 96; k++) {
      const t = (k / 96) * Math.PI * 2;
      const rad = r * (1 + 0.16 * Math.sin(3 * t + r * 0.04) + 0.07 * Math.cos(5 * t - r * 0.02));
      const x = -10 + rad * Math.cos(t);
      const y = 4 + rad * Math.sin(t);
      if (Math.abs(x) > limit || Math.abs(y) > limit) {
        pen = false;
        closed = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${project([x, y]).join(",")}`;
      pen = true;
    }
    if (d) s.path(closed ? `${d}Z` : d);
  }

  s.line([[34, 30, 0], [34, 30, 24]], styles.edge);
  s.face(
    [
      [34, 30, 24],
      [34, 30, 16],
      [34, 18, 20],
    ],
    styles.flag,
  );
  s.disc([34, 30], 3, styles.ring);
}

const DRAW: Record<LayerId, (s: Sketch) => void> = { network, routing, compute, pods, power, land };

const ART = Object.fromEntries(
  LAYERS.map(({ id }) => {
    const s = new Sketch();
    DRAW[id](s);
    return [id, s.items];
  }),
) as Record<LayerId, ReactElement[]>;

export interface StackArtProps {
  active: LayerId | null;
  onActive: (id: LayerId | null) => void;
}

/** Exploded line drawing of the stack; plates are painted bottom-up so upper ones occlude lower. */
export function StackArt({ active, onActive }: StackArtProps): ReactElement {
  const order = LAYERS.map((layer, i) => ({ layer, i })).reverse();

  return (
    <svg
      className={styles.art}
      viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
      style={{ "--gap-open": GAP } as CSSProperties}
      aria-hidden="true"
    >
      {order.map(({ layer, i }) => (
        <g
          key={layer.id}
          className={styles.layer}
          data-on={active === layer.id || undefined}
          style={{ "--o": i - MID, "--i": i } as CSSProperties}
          onPointerEnter={() => onActive(layer.id)}
          onPointerLeave={() => onActive(null)}
        >
          <g className={styles.lift}>{ART[layer.id]}</g>
        </g>
      ))}
    </svg>
  );
}
