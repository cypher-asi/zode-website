import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import type { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LAYER_OF, RACK, rackHeight, unitY } from "../model/catalog";
import type { Layer, Rack, RackPart } from "../model/types";

/*
 * Hidden-line rack drawings: light shaded fills that hide what's behind them,
 * with edges drawn over in each layer's colour. A rack is built in its own
 * frame (origin at the middle of its footprint on the floor, front toward +z)
 * and turned to face its aisle by the caller.
 */

export interface Palette {
  fill: THREE.Color;
  rack: THREE.Color;
  layers: Record<Layer, THREE.Color>;
}

/** Fill triangles, struct and detail line segments, and which triangles belong to which part. */
export class Buffers {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly colors: number[] = [];
  readonly struct: number[] = [];
  readonly structColors: number[] = [];
  readonly detail: number[] = [];
  readonly detailColors: number[] = [];
  /** First triangle of each part, ascending, then the part; triangles before the first belong to the cabinet. */
  readonly ranges: { start: number; partId: string }[] = [];

  get triangles(): number {
    return this.positions.length / 9;
  }

  private quad(a: THREE.Vector3Tuple, b: THREE.Vector3Tuple, c: THREE.Vector3Tuple, d: THREE.Vector3Tuple, n: THREE.Vector3Tuple, color: THREE.Color) {
    for (const p of [a, b, c, a, c, d]) {
      this.positions.push(...p);
      this.normals.push(...n);
      this.colors.push(color.r, color.g, color.b);
    }
  }

  /** Box faces; `open` leaves out the ones named, e.g. the front of a cabinet. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: THREE.Color, open: readonly string[] = []) {
    const f = (name: string) => !open.includes(name);
    if (f("px")) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], color);
    if (f("nx")) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], color);
    if (f("py")) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], color);
    if (f("ny")) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], color);
    if (f("pz")) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], color);
    if (f("nz")) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], color);
  }

  line(detail: boolean, a: THREE.Vector3Tuple, b: THREE.Vector3Tuple, color: THREE.Color) {
    (detail ? this.detail : this.struct).push(...a, ...b);
    (detail ? this.detailColors : this.structColors).push(color.r, color.g, color.b, color.r, color.g, color.b);
  }

  edges(detail: boolean, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: THREE.Color) {
    const c = (i: number): THREE.Vector3Tuple => [i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0];
    for (const [a, b] of BOX_EDGES) this.line(detail, c(a), c(b), color);
  }
}

const BOX_EDGES: [number, number][] = [
  [0, 1], [1, 3], [3, 2], [2, 0],
  [4, 5], [5, 7], [7, 6], [6, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

/** Half the width of the 19-inch equipment between the cabinet's rails. */
const EQUIP_HALF = 0.242;
const FRONT = RACK.depth / 2 - 0.05;

const PART_DEPTH: Partial<Record<RackPart["kind"], number>> = {
  gpu: 0.9,
  nas: 0.8,
  mgmt: 0.75,
  manifold: 0.2,
  panel: 0.12,
};

/** Bounds of a part in its rack's frame. */
export function partBox(part: RackPart): [number, number, number, number, number, number] {
  const depth = PART_DEPTH[part.kind] ?? 0.6;
  return [
    -EQUIP_HALF,
    unitY(part.uStart) + 0.002,
    FRONT - depth,
    EQUIP_HALF,
    unitY(part.uStart + part.uSize) - 0.002,
    FRONT,
  ];
}

const mixed = new THREE.Color();

/** Front-panel line work by kind: GPU trays, port rows, drive bays. */
function faceDetail(b: Buffers, part: RackPart, color: THREE.Color) {
  const [x0, y0, , x1, y1, z] = partBox(part);
  const zf = z + 0.001;
  const h = y1 - y0;
  const ticks = (n: number, ya: number, yb: number, inset = 0.02) => {
    const w = x1 - x0 - 2 * inset;
    for (let i = 1; i < n; i++) {
      const x = x0 + inset + (w * i) / n;
      b.line(true, [x, ya, zf], [x, yb, zf], color);
    }
  };
  const rule = (y: number) => b.line(true, [x0 + 0.01, y, zf], [x1 - 0.01, y, zf], color);
  switch (part.kind) {
    case "gpu":
      // GPU tray over the CPU tray, the eight GPU rails' NICs along the bottom.
      rule(y0 + h * 0.36);
      rule(y0 + h * 0.78);
      ticks(8, y0 + h * 0.08, y0 + h * 0.3);
      ticks(4, y0 + h * 0.42, y0 + h * 0.72, 0.06);
      break;
    case "leaf":
    case "spine":
    case "storageSwitch":
    case "oob":
      rule(y0 + h / 2);
      ticks(part.uSize > 1 ? 16 : 12, y0 + h * 0.15, y0 + h * 0.85, 0.05);
      break;
    case "nas":
      for (const f of [0.25, 0.5, 0.75]) rule(y0 + h * f);
      ticks(6, y0 + h * 0.05, y0 + h * 0.95);
      break;
    case "mgmt":
    case "ufm":
    case "edge":
    case "firewall":
      ticks(part.uSize > 1 ? 6 : 4, y0 + h * 0.2, y0 + h * 0.8, 0.12);
      break;
    case "manifold":
    case "panel":
      ticks(12, y0 + h * 0.3, y0 + h * 0.7, 0.04);
      break;
  }
}

/** Draws one rack into `b`, skipping parts on hidden layers; a hidden "rack" layer drops the cabinet shell too. */
export function drawRack(b: Buffers, rack: Rack, palette: Palette, hidden: ReadonlySet<Layer>) {
  const w = RACK.width / 2;
  const d = RACK.depth / 2;
  const h = rackHeight(rack.uHeight);
  const shell = !hidden.has("rack");
  if (shell) {
    // Sides, roof and back are panels; the front stays open onto the equipment.
    b.box(-w, 0, -d, w, h, d, palette.fill, ["pz", "ny"]);
    b.edges(false, -w, 0, -d, w, h, d, palette.rack);
    // Equipment rails just behind the open front.
    for (const x of [-EQUIP_HALF - 0.02, EQUIP_HALF + 0.02]) {
      b.line(true, [x, RACK.frame / 2, FRONT + 0.01], [x, h - RACK.frame / 2, FRONT + 0.01], palette.rack);
    }
  } else {
    // A footprint outline so an x-rayed rack still reads as a rack.
    b.edges(true, -w, 0, -d, w, 0.002, d, palette.rack);
  }
  for (const part of rack.parts) {
    const layer = LAYER_OF[part.kind];
    if (hidden.has(layer)) continue;
    const color = palette.layers[layer];
    b.ranges.push({ start: b.triangles, partId: part.id });
    const [x0, y0, z0, x1, y1, z1] = partBox(part);
    b.box(x0, y0, z0, x1, y1, z1, mixed.copy(palette.fill).lerp(color, 0.07));
    b.edges(false, x0, y0, z0, x1, y1, z1, color);
    faceDetail(b, part, color);
  }
}

/** Builds the fill mesh and both line weights for `b`, tracking every geometry in `track`. */
export function toObjects(
  b: Buffers,
  fill: THREE.Material,
  struct: LineMaterial,
  detail: LineMaterial,
  track: (g: THREE.BufferGeometry) => void,
): { mesh: THREE.Mesh | null; lines: LineSegments2[] } {
  let mesh: THREE.Mesh | null = null;
  if (b.positions.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(b.positions, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(b.normals, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(b.colors, 3));
    g.computeBoundingSphere();
    track(g);
    mesh = new THREE.Mesh(g, fill);
  }
  const lines: LineSegments2[] = [];
  for (const [segs, colors, mat] of [
    [b.struct, b.structColors, struct],
    [b.detail, b.detailColors, detail],
  ] as const) {
    if (!segs.length) continue;
    const g = new LineSegmentsGeometry();
    g.setPositions(segs);
    g.setColors(colors);
    track(g);
    lines.push(new LineSegments2(g, mat));
  }
  return { mesh, lines };
}

/** The part a fill triangle belongs to, or null for the cabinet. */
export function partAt(ranges: Buffers["ranges"], triangle: number): string | null {
  let found: string | null = null;
  for (const r of ranges) {
    if (r.start > triangle) break;
    found = r.partId;
  }
  return found;
}
