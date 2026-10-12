import type { CSSProperties, ReactElement } from "react";
import { Sketch, project, round, type Bounds, type P3 } from "@/features/zode-drawings/lineArt";
import { PRINCIPLES, type PrincipleId } from "./principles";
import styles from "./Principles.module.css";

/** Props for a group animated while its card is hovered; `k` staggers its start. */
const anim = (className: string, k = 0) => ({ className, style: { "--k": k } as CSSProperties });

function circle(s: Sketch, cx: number, cy: number, r: number, className: string): void {
  s.extend(cx, cy, r);
  s.el("circle", { cx: round(cx), cy: round(cy), r: round(r), className });
}

/** Point `r` from (cx, cy) at angle `a`. */
const polar = (cx: number, cy: number, r: number, a: number): [number, number] => [
  cx + r * Math.cos(a),
  cy + r * Math.sin(a),
];

/** A ribbed pod shell with a door on its +x end. */
function pod(s: Sketch, x: number, y: number, w: number, d: number, h: number): void {
  s.box(x, y, w, d, 0, h);
  for (let rx = x + 6; rx <= x + w - 6; rx += 8) s.line([[rx, y + d, 4], [rx, y + d, h - 4]]);
  const mid = y + d / 2;
  s.face(
    [
      [x + w, mid - 10, 2],
      [x + w, mid + 10, 2],
      [x + w, mid + 10, h - 8],
      [x + w, mid - 10, h - 8],
    ],
    styles.fine,
  );
  s.line([[x + w, mid, 2], [x + w, mid, h - 8]]);
}

/** A pod flying a pennant inside a surveyed parcel, its corner pins marked. */
function sovereign(s: Sketch): void {
  const [X, Y] = [100, 70];
  const corners: P3[] = [
    [-X, -Y],
    [X, -Y],
    [X, Y],
    [-X, Y],
  ];
  s.group(anim(styles.flow), () => s.line([...corners, corners[0]], styles.dash));

  const pin = (k: number) => {
    const [x, y] = corners[k];
    s.line([[x, y, 0], [x, y, 14]], styles.edge);
    const [px, py] = project([x, y, 14]);
    s.group(anim(styles.flash, k), () => circle(s, px, py, 2.6, styles.ring));
  };
  for (const k of [0, 1, 3]) pin(k);

  pod(s, -54, -20, 108, 40, 38);
  s.line([[30, 0, 38], [30, 0, 66]], styles.edge);
  s.group(anim(styles.wave), () =>
    s.face(
      [
        [30, 0, 66],
        [52, 0, 61],
        [30, 0, 56],
      ],
      styles.top,
    ),
  );

  pin(2);
}

/** One rotor blade from the hub at (cx, cy), pointing along `a`. */
function blade(s: Sketch, cx: number, cy: number, len: number, a: number): void {
  const n = a + Math.PI / 2;
  const [qx, qy] = polar(cx, cy, len * 0.25, a);
  const pts = [
    polar(cx, cy, 1.6, n),
    polar(qx, qy, 3.2, n),
    polar(cx, cy, len, a),
    polar(qx, qy, 0.8, n + Math.PI),
    polar(cx, cy, 1.6, n + Math.PI),
  ];
  for (const [px, py] of pts) s.extend(px, py);
  s.el("polygon", { points: pts.map(([px, py]) => `${round(px)},${round(py)}`).join(" "), className: styles.top });
}

/** A wind turbine and a row of solar panels feeding a pod. */
function sustainable(s: Sketch): void {
  const [TX, TY, TH] = [-104, -44, 80];

  s.group(anim(styles.flow), () => {
    s.line([[TX, TY, 0], [TX, 0, 0], [8, 0, 0]], styles.edge);
    s.line([[-46, 35, 0], [-30, 35, 0], [-30, 0, 0]], styles.edge);
  });

  s.line([[TX - 2, TY, 0], [TX - 1, TY, TH]], styles.edge);
  s.line([[TX + 2, TY, 0], [TX + 1, TY, TH]], styles.edge);
  s.box(TX - 4, TY - 3, 9, 6, TH, 4);
  const [hx, hy] = project([TX + 5, TY, TH + 2]);
  const R = 32;
  s.group(anim(styles.spin), () => {
    circle(s, hx, hy, R, styles.trace);
    for (let k = 0; k < 3; k++) blade(s, hx, hy, R - 2, (k / 3) * Math.PI * 2 - Math.PI / 2);
    circle(s, hx, hy, 2.8, styles.ring);
  });

  pod(s, 8, -22, 100, 44, 38);

  for (let k = 0; k < 3; k++) {
    const x = -136 + k * 30;
    s.line([[x + 12, 29, 0], [x + 12, 29, 14.7]], styles.edge);
    s.line([[x + 12, 39, 0], [x + 12, 39, 8.7]], styles.edge);
    s.group(anim(styles.shade, k), () =>
      s.face(
        [
          [x, 26, 17],
          [x + 24, 26, 17],
          [x + 24, 44, 6],
          [x, 44, 6],
        ],
        styles.top,
      ),
    );
    s.line([[x, 35, 11.5], [x + 24, 35, 11.5]]);
    for (const cx of [x + 8, x + 16]) s.line([[cx, 26, 17], [cx, 44, 6]]);
  }
}

/** Pods with overlapping coverage, meshed so every site reaches the others. */
function distributed(s: Sketch): void {
  const SITES: readonly (readonly [number, number])[] = [
    [-100, 20],
    [-10, -90],
    [0, 0],
    [96, -10],
    [20, 96],
  ];
  const LINKS = [
    [0, 1],
    [1, 3],
    [3, 4],
    [4, 0],
    [2, 0],
    [2, 1],
    [2, 3],
    [2, 4],
  ];

  for (const [x, y] of SITES) s.disc([x, y], 30, styles.trace);
  s.group(anim(styles.flow), () => {
    for (const [a, b] of LINKS) s.line([[...SITES[a]], [...SITES[b]]], styles.edge);
  });
  for (const [x, y] of SITES) s.disc([x, y], 2.2, styles.ink);

  const order = SITES.map((p, k) => ({ x: p[0], y: p[1], k })).sort((a, b) => a.x + a.y - (b.x + b.y));
  for (const { x, y, k } of order) {
    s.group(anim(styles.shade, k), () => {
      s.box(x - 16, y - 9, 32, 18, 0, 18);
      for (let rx = x - 10; rx <= x + 10; rx += 5) s.line([[rx, y + 9, 3], [rx, y + 9, 15]]);
    });
  }
}

/** A see-through pod: a dashed shell around the racks inside it. */
function open(s: Sketch): void {
  const [X, Y, H] = [90, 34, 60];
  const corners: P3[] = [];
  for (const x of [-X, X]) for (const y of [-Y, Y]) for (const z of [0, H]) corners.push([x, y, z]);
  const back = (p: P3) => p[0] === -X && p[1] === -Y && p[2] === 0;
  const edges: [P3, P3][] = [];
  corners.forEach((a, i) =>
    corners.slice(i + 1).forEach((b) => {
      if (a.filter((v, j) => v !== b[j]).length === 1) edges.push([a, b]);
    }),
  );

  for (const [a, b] of edges) if (back(a) || back(b)) s.line([a, b], styles.hidden);

  for (let k = 0; k < 5; k++) {
    const x = -76 + k * 32;
    s.group(anim(styles.shade, k), () => s.box(x, -22, 24, 44, 0, 48));
    for (let z = 6; z <= 42; z += 4) s.line([[x + 3, 22, z], [x + 21, 22, z]]);
    s.disc([x + 19, 22, 44], 0.9, styles.ink);
  }

  s.group(anim(styles.flow), () => {
    for (const [a, b] of edges) if (!back(a) && !back(b)) s.line([a, b], styles.dash);
  });
}

const DRAW: Record<PrincipleId, (s: Sketch) => void> = { sovereign, sustainable, distributed, open };

const SKETCHES = PRINCIPLES.map(({ id }) => {
  const s = new Sketch(styles);
  DRAW[id](s);
  return { id, items: s.items, bounds: s.bounds(6) };
});

/** Every drawing is centred in one shared frame, so they all render at the same scale. */
const FRAME = {
  w: Math.max(...SKETCHES.map((d) => d.bounds.w)),
  h: Math.max(...SKETCHES.map((d) => d.bounds.h)),
};

const ART = Object.fromEntries(
  SKETCHES.map(({ id, items, bounds: b }) => {
    const view: Bounds = {
      x: round(b.x + b.w / 2 - FRAME.w / 2),
      y: round(b.y + b.h / 2 - FRAME.h / 2),
      w: FRAME.w,
      h: FRAME.h,
    };
    return [id, { items, view }];
  }),
) as Record<PrincipleId, { items: ReactElement[]; view: Bounds }>;

/** Line drawing for one principle. */
export function PrincipleArt({ id }: { id: PrincipleId }): ReactElement {
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
