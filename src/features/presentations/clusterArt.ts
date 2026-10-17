import type { Deployment } from "@/features/deployments/types";
import { PdfSketch } from "@/features/pdf/lineArt";
import { backToFront } from "@/features/zode-drawings/projection";

/*
 * An exploded line drawing of a ZODE cluster for the presentation: its plates
 * lifted apart, from the power skid up through cooling, the GPU nodes and the
 * network to the lid, with dashed leaders at the corners where they meet.
 * Model units: x across the plate, y along it toward the viewer, z up.
 */

/** Half the plate's width and depth. */
const HX = 100;
const HY = 64;
/** How far apart the plates sit, from one's top to the next's. */
const GAP = 76;

interface Plate {
  thickness: number;
  draw: (s: PdfSketch) => void;
}

/** Fine vertical lines across the plate's two front faces, like vents. */
function vents(s: PdfSketch, z0: number, z1: number, step: number): void {
  for (let x = -HX + step; x < HX; x += step) s.line([[x, HY, z0], [x, HY, z1]]);
  for (let y = -HY + step; y < HY; y += step) s.line([[HX, y, z0], [HX, y, z1]]);
}

/** The skid: power shelves along the back, a busbar, and PDUs in front. */
function power(s: PdfSketch): void {
  vents(s, -11, -3, 8);
  const shelves = Array.from({ length: 6 }, (_, k) => ({ x: -94 + k * 32, y: -58 }));
  for (const { x, y } of shelves.sort(backToFront)) {
    s.box(x, y, 26, 20, 0, 13, "fine");
    s.line([[x + 26, y + 6, 4], [x + 26, y + 6, 10], [x + 26, y + 14, 10]]);
  }
  s.box(-92, -26, 184, 6, 0, 5, "fine");
  const pdus = Array.from({ length: 4 }, (_, k) => ({ x: -90 + k * 46, y: 16 }));
  for (const { x, y } of pdus.sort(backToFront)) {
    s.line([[x + 18, y, 3], [x + 18, -20, 3]]);
    s.box(x, y, 36, 30, 0, 15, "fine");
    for (let z = 4; z <= 11; z += 3.5) s.line([[x + 6, y + 30, z], [x + 30, y + 30, z]]);
  }
}

/** Liquid: a CDU feeding supply and return manifolds, a branch to each node. */
function liquid(s: PdfSketch): void {
  s.box(-96, -58, 30, 112, 0, 20, "fine");
  for (let y = -46; y <= 40; y += 12) s.line([[-66, y, 5], [-66, y, 15]]);
  for (const y of [-40, -26]) s.box(-66, y, 158, 5, 2, 5, "fine");
  for (let x = -54; x <= 84; x += 23) {
    s.line([[x, -21, 4], [x, 52, 4]]);
    s.disc([x, 52, 4], 2.2);
  }
}

/** Air: a grid of fans in their frames. */
function air(s: PdfSketch): void {
  const fans: { x: number; y: number }[] = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) fans.push({ x: -94 + i * 48, y: -58 + j * 60 });
  for (const { x, y } of fans.sort(backToFront)) {
    s.box(x, y, 44, 54, 0, 4, "fine");
    const [cx, cy] = [x + 22, y + 27];
    s.disc([cx, cy, 4], 18, "fine", true);
    for (let k = 0; k < 6; k++) {
      const t = (k / 6) * Math.PI * 2;
      s.line([[cx + 5 * Math.cos(t), cy + 5 * Math.sin(t), 4], [cx + 16 * Math.cos(t + 0.6), cy + 16 * Math.sin(t + 0.6), 4]]);
    }
    s.disc([cx, cy, 4], 5);
  }
}

/** Eight-GPU node trays, four across and two deep. */
function compute(s: PdfSketch): void {
  const trays: { x: number; y: number }[] = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) trays.push({ x: -94 + i * 47, y: -60 + j * 62 });
  for (const { x, y } of trays.sort(backToFront)) {
    s.box(x, y, 44, 56, 0, 7, "fine");
    for (let vx = x + 4; vx < x + 30; vx += 3) s.line([[vx, y + 56, 2], [vx, y + 56, 5]]);
    const gpus: { x: number; y: number }[] = [];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) gpus.push({ x: x + 4 + i * 10, y: y + 8 + j * 24 });
    for (const g of gpus.sort(backToFront)) s.box(g.x, g.y, 7, 14, 7, 5, "fine");
  }
}

/** Two spine switches at the back, fibre down to four leaves in front. */
function network(s: PdfSketch): void {
  const spines = [-74, 14].map((x) => ({ x, y: -56 }));
  const leaves = Array.from({ length: 4 }, (_, k) => ({ x: -92 + k * 47, y: 28 }));
  for (const { x, y } of spines) {
    s.box(x, y, 60, 18, 0, 9, "fine");
    for (let px = x + 4; px < x + 56; px += 5) s.face([[px, y + 18, 3], [px + 3, y + 18, 3], [px + 3, y + 18, 6], [px, y + 18, 6]], "fine");
  }
  for (const leaf of leaves) {
    for (const spine of spines) s.line([[leaf.x + 18, leaf.y + 7, 6], [spine.x + 30, spine.y + 9, 9]]);
  }
  for (const { x, y } of leaves) {
    s.box(x, y, 36, 16, 0, 6, "fine");
    for (let px = x + 3; px < x + 33; px += 4.5) s.face([[px, y + 16, 1.5], [px + 2.5, y + 16, 1.5], [px + 2.5, y + 16, 4.5], [px, y + 16, 4.5]], "fine");
  }
}

/** The lid: an inset panel and a ring at its centre. */
function lid(s: PdfSketch): void {
  s.face([[-HX + 8, -HY + 8], [HX - 8, -HY + 8], [HX - 8, HY - 8], [-HX + 8, HY - 8]], "fine");
  s.disc([0, 0], 36, "fine");
  s.disc([0, 0], 24, "fine");
  s.disc([0, 0], 14, "fine", true);
  for (const [x, y] of [[-HX + 4, -HY + 4], [HX - 4, -HY + 4], [HX - 4, HY - 4], [-HX + 4, HY - 4]] as const) s.disc([x, y], 1.6);
}

/** The visible corners, where the leaders run between plates. */
const CORNERS = [
  [HX, -HY],
  [HX, HY],
  [-HX, HY],
] as const;

/** The cluster drawing, its cooling plate drawn for `cooling`. */
export function clusterArt(cooling: Deployment["cooling"]): PdfSketch {
  const plates: Plate[] = [
    { thickness: 14, draw: power },
    { thickness: 5, draw: cooling === "air" ? air : liquid },
    { thickness: 6, draw: compute },
    { thickness: 5, draw: network },
    { thickness: 7, draw: lid },
  ];
  const s = new PdfSketch();
  plates.forEach((plate, i) => {
    s.at(i * GAP, () => {
      s.box(-HX, -HY, 2 * HX, 2 * HY, -plate.thickness, plate.thickness);
      plate.draw(s);
    });
    const next = plates[i + 1];
    if (next) {
      for (const [x, y] of CORNERS) s.line([[x, y, i * GAP], [x, y, (i + 1) * GAP - next.thickness]], "fine", true);
    }
  });
  return s;
}
