import type { CSSProperties, ReactElement } from "react";
import { Sketch as BaseSketch, backToFront, project, rng, type P3 } from "../lineart";
import { LAYERS, type LayerId } from "./layers";
import styles from "./FullStack.module.css";

/** Half a plate's side length, in plane units. */
const H = 90;
const PLATE = 8;
const BASE = 24;
/** Exploded spacing between plates, in viewBox units. */
const GAP = 84;
const MID = (LAYERS.length - 1) / 2;
/** Room past the outermost plate centres for the plate itself plus its tallest detail. */
const REACH = MID * GAP + 124;

export const VIEW = { x: -184, y: -REACH, w: 368, h: 2 * REACH };

/** Leader lines meet their plates at the top face's rightmost corner: `ANCHOR_X` across, `labelY` down. */
export const ANCHOR_X = 2 * H;

/** Exploded viewBox y where a layer's leader line meets its plate. */
export function labelY(index: number): number {
  return (index - MID) * GAP;
}

/** Props for a group animated while its plate is hovered; `k` staggers its start. */
const anim = (className: string, k = 0) => ({ className, style: { "--k": k } as CSSProperties });

/** A `Sketch` that knows the plate size shared by every layer. */
class Sketch extends BaseSketch {
  constructor() {
    super(styles);
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

  s.group(anim(styles.flow), () => {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const a = nodes[i][j];
        const next = [i + 1 < n && nodes[i + 1][j], j + 1 < n && nodes[i][j + 1]];
        if (i + 1 < n && j + 1 < n && rand() < 0.3) next.push(nodes[i + 1][j + 1]);
        for (const b of next) if (b) s.line([[a.x, a.y], [b.x, b.y]]);
      }
    }
  });

  const all = nodes.flat().sort(backToFront);
  for (const p of all) if (!p.hub) s.disc([p.x, p.y], 1.8, styles.ink);
  all
    .filter((p) => p.hub)
    .forEach((p, k) => {
      s.group(anim(styles.flash, k * 2), () => s.disc([p.x, p.y], 4.2, styles.ring));
      s.line([[p.x, p.y, 0], [p.x, p.y, 16]], styles.edge);
      s.disc([p.x, p.y, 16], 1.8, styles.ink);
    });

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

  const turns: ((x: number, y: number) => P3)[] = [
    (x, y) => [x, y],
    (x, y) => [-y, x],
    (x, y) => [-x, -y],
    (x, y) => [y, -x],
  ];
  turns.forEach((turn, t) => {
    for (let j = -4; j <= 4; j++) {
      const a = j * 3.5;
      const b = j * 11;
      s.group(anim(styles.flow), () =>
        s.line([turn(17, a), turn(26, a), turn(26 + Math.abs(b - a), b), turn(63, b)]),
      );
      s.group(anim(styles.dim, t * 9 + j + 4), () => s.disc(turn(66, b), 1.5, styles.ink));
    }
  });

  s.box(-16, -16, 32, 32, 0, 5);
  for (let x = -9; x <= 9; x += 6) {
    for (let y = -9; y <= 9; y += 6) s.disc([x, y, 5], 1, styles.ink);
  }
}

function compute(s: Sketch): void {
  s.slab(PLATE);
  s.inset(H - 7);

  const size = 16;
  const pitch = 24;
  const cells: { x: number; y: number; k: number }[] = [];
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) cells.push({ x: -68 + i * pitch, y: -68 + j * pitch, k: i + j });
  }
  for (const c of cells.sort(backToFront)) {
    s.group(anim(styles.shade, c.k), () => {
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
    });
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
  units.sort(backToFront).forEach(({ x, y }, k) => {
    const [x1, y1] = [x + w, y + d];
    s.group(anim(styles.hop, k * 2), () => {
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
    });
  });
}

function power(s: Sketch): void {
  s.slab(PLATE);

  const cells: { x: number; y: number; k: number }[] = [];
  for (const y of [-80, -56]) {
    for (let c = 0; c < 7; c++) cells.push({ x: -78 + c * 23, y, k: c });
  }
  for (const { x, y, k } of cells.sort(backToFront)) {
    s.group(anim(styles.shade, k * 1.5), () => s.box(x, y, 18, 16, 0, 14));
    s.line([[x, y + 16, 10], [x + 18, y + 16, 10], [x + 18, y, 10]]);
    s.line([[x + 5, y + 8, 14], [x + 5, y + 8, 16]], styles.edge);
  }

  for (let k = 0; k < 6; k++) {
    const y = -28 + k * 18;
    s.group(anim(styles.shade, 4 + k * 1.5), () =>
      s.face(
        [
          [-78, y, 9],
          [78, y, 9],
          [78, y + 12, 3],
          [-78, y + 12, 3],
        ],
        styles.top,
      ),
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
    if (d) s.group(anim(styles.ripple, r / 12), () => s.path(closed ? `${d}Z` : d));
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

/** Each slab's projected outline, used as a hover target that stays put while the drawing lifts. */
const HIT = Object.fromEntries(
  LAYERS.map(({ id }) => {
    const t = id === "land" ? BASE : PLATE;
    const outline: P3[] = [
      [-H, -H, 0],
      [H, -H, 0],
      [H, -H, -t],
      [H, H, -t],
      [-H, H, -t],
      [-H, H, 0],
    ];
    return [id, outline.map((p) => project(p).join(",")).join(" ")];
  }),
) as Record<LayerId, string>;

export interface StackArtProps {
  active: LayerId | null;
  onActive: (id: LayerId | null) => void;
}

/**
 * Exploded line drawing of the stack; plates are painted bottom-up so upper ones occlude lower.
 * SVG has no z-index, so the hovered plate is repainted last as a pointer-transparent copy.
 */
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
          <polygon className={styles.hit} points={HIT[layer.id]} />
          <g className={styles.lift}>{ART[layer.id]}</g>
        </g>
      ))}
      {active && (
        <g
          key={active}
          className={styles.layer}
          data-on
          data-raised
          style={{ "--o": LAYERS.findIndex((l) => l.id === active) - MID } as CSSProperties}
        >
          <g className={styles.lift}>{ART[active]}</g>
        </g>
      )}
    </svg>
  );
}
