import * as THREE from "three";

/*
 * Loads the ZODE / Barnhouse asset from /public and turns the single,
 * undivided OBJ mesh into a hierarchy of toggleable layers plus a two-weight
 * line drawing.
 *
 * The OBJ is parsed directly (rather than via OBJLoader) so we keep the
 * original polygon faces. That lets us:
 *   - Build the hidden-line edges from real polygon perimeters, so triangle-
 *     fan diagonals never show up as spurious diagonal lines on flat panels.
 *   - Compute connected components (discrete physical parts) from the shared
 *     vertex indices, and weight lines by part size: small parts (board
 *     cladding, standing seams, mullions, trim) draw as thin gray "detail"
 *     lines, while the large shells / deck / gables draw as the bold
 *     "structural" outline.
 *
 * Edges are computed once over the whole model and then bucketed into layers
 * by their midpoint, so adjacent layers never double-draw a shared seam.
 *
 * Each triangle/edge is assigned to one sub-layer; sub-layers are grouped into
 * categories for the UI:
 *   Roof        -> Left slope / Right slope / Ridge / Eaves & soffit
 *   Glazing     -> Front gable / Back gable        (Z-facing gable ends)
 *   Walls       -> Left wall / Right wall          (X-facing side walls)
 *   Base / Deck -> Deck & floor / Foundation
 *
 * The model is recentered (X/Z to origin, base at y = 0) and uniformly scaled
 * so its height matches the original parametric ridge, reusing the camera
 * framing. The parse is cached at module scope so the multiple CabinScene
 * mounts never re-read the ~7.7 MB file.
 */

export interface SubLayerDef {
  id: string;
  label: string;
}

export interface CategoryDef {
  id: string;
  label: string;
  subs: SubLayerDef[];
}

export const CATEGORIES: ReadonlyArray<CategoryDef> = [
  {
    id: "roof",
    label: "Roof",
    subs: [
      { id: "roof.left", label: "Left slope" },
      { id: "roof.right", label: "Right slope" },
      { id: "roof.ridge", label: "Ridge" },
      { id: "roof.eaves", label: "Eaves & soffit" },
    ],
  },
  {
    id: "glazing",
    label: "Glazing",
    subs: [
      { id: "glazing.front", label: "Front gable" },
      { id: "glazing.back", label: "Back gable" },
    ],
  },
  {
    id: "walls",
    label: "Walls",
    subs: [
      { id: "walls.left", label: "Left wall" },
      { id: "walls.right", label: "Right wall" },
    ],
  },
  {
    id: "base",
    label: "Base / Deck",
    subs: [
      { id: "base.deck", label: "Deck & floor" },
      { id: "base.foundation", label: "Foundation" },
    ],
  },
];

export const SUB_LAYER_IDS: ReadonlyArray<string> = CATEGORIES.flatMap((c) =>
  c.subs.map((s) => s.id),
);

/** Maps a sub-layer id back to its category id (the text before the dot). */
export function categoryOf(subId: string): string {
  return subId.slice(0, subId.indexOf("."));
}

export interface CabinLayers {
  /** Per sub-layer solid geometry (flat-shaded triangles), base at y = 0. */
  solids: Record<string, THREE.BufferGeometry>;
  /** Per sub-layer line segment positions, split into two visual weights. */
  edges: Record<string, { struct: Float32Array; detail: Float32Array }>;
  /** Sub-layer ids that actually contain geometry, in taxonomy order. */
  present: string[];
  /** Bounding sphere radius of the assembled model (for camera framing). */
  radius: number;
  /** Scaled extents of the assembled model (X width, Y height, Z depth). */
  size: { x: number; y: number; z: number };
  /** Scaled height of the floor/deck surface (top of the base), base at y = 0. */
  floorY: number;
}

const MODEL_URL = "/zode_3D.obj";
const TARGET_HEIGHT = 33; // matches the former parametric ridge height

// An edge is drawn when adjacent faces differ by more than this, or when it
// is a mesh boundary. Triangulation diagonals are never considered.
const FEATURE_ANGLE_COS = Math.cos((20 * Math.PI) / 180);
// Components with at most this many faces are fine detail (thin gray lines).
const SMALL_MAX_FACES = 120;

// Height fractions (0 = base, 1 = ridge), tuned against the model's extents.
const FOUNDATION_FRAC = 0.095;
const BASE_FRAC = 0.19;
const EAVE_FRAC = 0.52;
const RIDGE_FRAC = 0.85;

// Flat tan diffuse from zode_3D.mtl (Kd 0.8824 0.7765 0.3412).
export const MTL_DIFFUSE = new THREE.Color().setRGB(0.8824, 0.7765, 0.3412);

let cache: Promise<CabinLayers> | null = null;

/** Assigns a triangle/edge to a sub-layer from its centroid + average normal. */
function classify(
  t: number,
  cx: number,
  cz: number,
  nx: number,
  ny: number,
  nz: number,
): string {
  if (t < BASE_FRAC) return t < FOUNDATION_FRAC ? "base.foundation" : "base.deck";

  const ax = Math.abs(nx);
  const ay = Math.abs(ny);
  const az = Math.abs(nz);

  if (az >= ax && az >= ay) return cz > 0 ? "glazing.front" : "glazing.back";

  if (t >= EAVE_FRAC) {
    if (ay > 0.55 && ny < 0) return "roof.eaves";
    if (ax < 0.2 && t > RIDGE_FRAC) return "roof.ridge";
    return nx < 0 ? "roof.left" : "roof.right";
  }

  return nx < 0 ? "walls.left" : "walls.right";
}

interface ParsedObj {
  positions: Float32Array; // xyz per vertex (already transformed)
  faces: number[][]; // polygon vertex indices (0-based)
}

function parseObj(text: string): ParsedObj {
  const pos: number[] = [];
  const faces: number[][] = [];
  let start = 0;
  const len = text.length;
  while (start < len) {
    let end = text.indexOf("\n", start);
    if (end === -1) end = len;
    // Cheap per-line dispatch on the first two characters.
    if (text.charCodeAt(start) === 118 /* v */) {
      const c1 = text.charCodeAt(start + 1);
      if (c1 === 32 /* space */) {
        const parts = text.slice(start + 2, end).trim().split(/\s+/);
        pos.push(+parts[0], +parts[1], +parts[2]);
      }
    } else if (
      text.charCodeAt(start) === 102 /* f */ &&
      text.charCodeAt(start + 1) === 32
    ) {
      const parts = text.slice(start + 2, end).trim().split(/\s+/);
      const face: number[] = [];
      for (const p of parts) {
        const slash = p.indexOf("/");
        face.push(parseInt(slash === -1 ? p : p.slice(0, slash), 10) - 1);
      }
      faces.push(face);
    }
    start = end + 1;
  }
  return { positions: new Float32Array(pos), faces };
}

async function build(): Promise<CabinLayers> {
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`Failed to fetch ${MODEL_URL}: ${res.status}`);
  const { positions, faces } = parseObj(await res.text());

  // --- Recenter (X/Z to origin, base at y = 0) and scale to TARGET_HEIGHT ---
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i],
      y = positions[i + 1],
      z = positions[i + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const scale = TARGET_HEIGHT / (maxY - minY);
  const ox = (minX + maxX) / 2;
  const oz = (minZ + maxZ) / 2;

  // --- Connected components (discrete parts) via union-find on raw indices ---
  const vCount = positions.length / 3;
  const parent = new Int32Array(vCount);
  for (let i = 0; i < vCount; i++) parent[i] = i;
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  for (const f of faces) for (let i = 1; i < f.length; i++) union(f[0], f[i]);

  const compSize = new Map<number, number>();
  for (const f of faces) {
    const r = find(f[0]);
    compSize.set(r, (compSize.get(r) ?? 0) + 1);
  }

  // Recenter (X/Z to origin, base at y = 0) and scale to TARGET_HEIGHT.
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = (positions[i] - ox) * scale;
    positions[i + 1] = (positions[i + 1] - minY) * scale;
    positions[i + 2] = (positions[i + 2] - oz) * scale;
  }
  const height = (maxY - minY) * scale;

  // --- Face normals (Newell) + centroids (for convexity tests) ---
  const faceNormals = new Float32Array(faces.length * 3);
  const faceCentroids = new Float32Array(faces.length * 3);
  for (let fi = 0; fi < faces.length; fi++) {
    const f = faces[fi];
    let nx = 0,
      ny = 0,
      nz = 0,
      cx = 0,
      cy = 0,
      cz = 0;
    for (let i = 0; i < f.length; i++) {
      const a = f[i] * 3;
      const b = f[(i + 1) % f.length] * 3;
      const ax = positions[a],
        ay = positions[a + 1],
        az = positions[a + 2];
      const bx = positions[b],
        by = positions[b + 1],
        bz = positions[b + 2];
      nx += (ay - by) * (az + bz);
      ny += (az - bz) * (ax + bx);
      nz += (ax - bx) * (ay + by);
      cx += ax;
      cy += ay;
      cz += az;
    }
    const l = Math.hypot(nx, ny, nz) || 1;
    faceNormals[fi * 3] = nx / l;
    faceNormals[fi * 3 + 1] = ny / l;
    faceNormals[fi * 3 + 2] = nz / l;
    faceCentroids[fi * 3] = cx / f.length;
    faceCentroids[fi * 3 + 1] = cy / f.length;
    faceCentroids[fi * 3 + 2] = cz / f.length;
  }

  // --- Edge map keyed by sorted vertex-index pair (polygon perimeters only) ---
  interface EdgeRec {
    f0: number;
    f1: number;
  }
  const edgeMap = new Map<number, EdgeRec>();
  const KEY = (a: number, b: number): number =>
    a < b ? a * vCount + b : b * vCount + a;
  for (let fi = 0; fi < faces.length; fi++) {
    const f = faces[fi];
    for (let i = 0; i < f.length; i++) {
      const a = f[i];
      const b = f[(i + 1) % f.length];
      if (a === b) continue;
      const k = KEY(a, b);
      const rec = edgeMap.get(k);
      if (rec) rec.f1 = fi;
      else edgeMap.set(k, { f0: fi, f1: -1 });
    }
  }

  // --- Bucket drawn edges by sub-layer + weight ---
  const detailBuckets: Record<string, number[]> = {};
  const structBuckets: Record<string, number[]> = {};
  for (const id of SUB_LAYER_IDS) {
    detailBuckets[id] = [];
    structBuckets[id] = [];
  }

  for (const [k, rec] of edgeMap) {
    const a = Math.floor(k / vCount);
    const b = k % vCount;
    const n0 = rec.f0 * 3;
    let nx = faceNormals[n0],
      ny = faceNormals[n0 + 1],
      nz = faceNormals[n0 + 2];

    const ax = positions[a * 3],
      ayy = positions[a * 3 + 1],
      az = positions[a * 3 + 2];
    const bx = positions[b * 3],
      byy = positions[b * 3 + 1],
      bz = positions[b * 3 + 2];
    const mx = (ax + bx) / 2,
      my = (ayy + byy) / 2,
      mz = (az + bz) / 2;

    let concave = false;
    if (rec.f1 !== -1) {
      const n1 = rec.f1 * 3;
      const dot =
        nx * faceNormals[n1] + ny * faceNormals[n1 + 1] + nz * faceNormals[n1 + 2];
      if (dot > FEATURE_ANGLE_COS) continue; // too coplanar to be a feature
      // Concave when the neighbour's centroid sits in front of face0's plane.
      const f1c = rec.f1 * 3;
      const toC1x = faceCentroids[f1c] - mx;
      const toC1y = faceCentroids[f1c + 1] - my;
      const toC1z = faceCentroids[f1c + 2] - mz;
      concave = nx * toC1x + ny * toC1y + nz * toC1z > 0;
      nx += faceNormals[n1];
      ny += faceNormals[n1 + 1];
      nz += faceNormals[n1 + 2];
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l;
      ny /= l;
      nz /= l;
    }

    const id = classify(my / height, mx, mz, nx, ny, nz);

    const small = (compSize.get(find(a)) ?? 0) <= SMALL_MAX_FACES;
    const cat = categoryOf(id);
    // Detail (thin, dark) = fine parts, glazing, concave surface reveals, and
    // the whole base/deck framing (sill, footings, joists) so the lower base
    // reads like the walls; structural (lighter) = the convex outer perimeter
    // of the large roof/wall shells.
    const detail = small || concave || cat === "glazing" || cat === "base";
    const bucket = detail ? detailBuckets[id] : structBuckets[id];
    bucket.push(ax, ayy, az, bx, byy, bz);
  }

  // --- Per sub-layer flat-shaded solids (triangulated polygon fans) ---
  const solidBuckets: Record<string, { p: number[]; n: number[] }> = {};
  for (const id of SUB_LAYER_IDS) solidBuckets[id] = { p: [], n: [] };
  for (let fi = 0; fi < faces.length; fi++) {
    const f = faces[fi];
    const n0 = fi * 3;
    const nx = faceNormals[n0],
      ny = faceNormals[n0 + 1],
      nz = faceNormals[n0 + 2];
    let cx = 0,
      cy = 0,
      cz = 0;
    for (const vi of f) {
      cx += positions[vi * 3];
      cy += positions[vi * 3 + 1];
      cz += positions[vi * 3 + 2];
    }
    cx /= f.length;
    cy /= f.length;
    cz /= f.length;
    const id = classify(cy / height, cx, cz, nx, ny, nz);
    const bucket = solidBuckets[id];
    for (let i = 1; i < f.length - 1; i++) {
      for (const vi of [f[0], f[i], f[i + 1]]) {
        bucket.p.push(positions[vi * 3], positions[vi * 3 + 1], positions[vi * 3 + 2]);
        bucket.n.push(nx, ny, nz);
      }
    }
  }

  const solids: Record<string, THREE.BufferGeometry> = {};
  const edges: Record<string, { struct: Float32Array; detail: Float32Array }> = {};
  const present: string[] = [];
  for (const id of SUB_LAYER_IDS) {
    const hasSolid = solidBuckets[id].p.length > 0;
    const hasLines =
      structBuckets[id].length > 0 || detailBuckets[id].length > 0;
    if (!hasSolid && !hasLines) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(solidBuckets[id].p, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(solidBuckets[id].n, 3));
    solids[id] = g;
    edges[id] = {
      struct: new Float32Array(structBuckets[id]),
      detail: new Float32Array(detailBuckets[id]),
    };
    present.push(id);
  }

  const radius = (Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2) * scale;
  const size = {
    x: (maxX - minX) * scale,
    y: height,
    z: (maxZ - minZ) * scale,
  };
  const floorY = BASE_FRAC * height;

  return { solids, edges, present, radius, size, floorY };
}

export function loadCabinLayers(): Promise<CabinLayers> {
  if (!cache) cache = build();
  return cache;
}
