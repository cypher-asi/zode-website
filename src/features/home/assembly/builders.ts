import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { CabinLayers } from "./model/cabinModel";
import { END_CAP, POD, partBounds, type Part, type Shape } from "./podSpec";
import { ARM_LINKS, BELT, BELT_TOP, GANTRY, POD_PITCH, SHELL_X, type Vec3 } from "./timeline";

/*
 * Hidden-line geometry for the assembly line. Every solid is a background-
 * coloured fill (polygon-offset back so its own edges win the depth test)
 * plus fat-line edges in two weights: structural outlines and thinner detail.
 */

/** Fixed viewing direction (from the scene toward the camera); used for cylinder silhouettes. */
export const VIEW_DIR = new THREE.Vector3(0, 0.55, 1).normalize();

export interface LineMats {
  struct: LineMaterial;
  detail: LineMaterial;
}

/** Owns every geometry / material created for the scene so they can be disposed together. */
export class Kit {
  readonly geometries: THREE.BufferGeometry[] = [];
  readonly materials: THREE.Material[] = [];
  readonly lineMaterials: LineMaterial[] = [];

  constructor(readonly fill: THREE.MeshBasicMaterial) {
    this.materials.push(fill);
  }

  track<G extends THREE.BufferGeometry>(g: G): G {
    this.geometries.push(g);
    return g;
  }

  lineMats(struct: number, detail: number, structWidth: number, detailWidth: number): LineMats {
    const mats = {
      struct: new LineMaterial({ color: struct, linewidth: structWidth, transparent: true }),
      detail: new LineMaterial({ color: detail, linewidth: detailWidth, transparent: true }),
    };
    this.lineMaterials.push(mats.struct, mats.detail);
    this.materials.push(mats.struct, mats.detail);
    return mats;
  }

  lines(segments: ArrayLike<number>, mat: LineMaterial): LineSegments2 | null {
    if (segments.length === 0) return null;
    const g = this.track(new LineSegmentsGeometry());
    g.setPositions(segments instanceof Float32Array ? segments : new Float32Array(segments));
    g.computeBoundingSphere();
    return new LineSegments2(g, mat);
  }

  /** Fill mesh + both line weights in one group. */
  solid(fill: THREE.BufferGeometry | null, segs: Segs, mats: LineMats, fillMat = this.fill): THREE.Group {
    const group = new THREE.Group();
    if (fill) group.add(new THREE.Mesh(this.track(fill), fillMat));
    const s = this.lines(segs.struct, mats.struct);
    const d = this.lines(segs.detail, mats.detail);
    if (s) group.add(s);
    if (d) group.add(d);
    return group;
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}

class Segs {
  readonly struct: number[] = [];
  readonly detail: number[] = [];

  push(detail: boolean, a: THREE.Vector3, b: THREE.Vector3): void {
    (detail ? this.detail : this.struct).push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
}

const BOX_EDGES: [number, number][] = [
  [0, 1], [1, 3], [3, 2], [2, 0],
  [4, 5], [5, 7], [7, 6], [6, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

/** Box from centre + size, optionally rotated about X. Appends edges and returns the fill geometry. */
function boxPiece(
  segs: Segs,
  center: THREE.Vector3,
  size: THREE.Vector3,
  detail = false,
  tilt = 0,
  fill = true,
): THREE.BufferGeometry | null {
  const rot = new THREE.Matrix4().makeRotationX(tilt);
  const corners: THREE.Vector3[] = [];
  for (let i = 0; i < 8; i++) {
    corners.push(
      new THREE.Vector3(
        (i & 1 ? 0.5 : -0.5) * size.x,
        (i & 2 ? 0.5 : -0.5) * size.y,
        (i & 4 ? 0.5 : -0.5) * size.z,
      )
        .applyMatrix4(rot)
        .add(center),
    );
  }
  for (const [a, b] of BOX_EDGES) segs.push(detail, corners[a], corners[b]);
  if (!fill) return null;
  const g = new THREE.BoxGeometry(size.x, size.y, size.z);
  g.applyMatrix4(rot);
  g.translate(center.x, center.y, center.z);
  return g;
}

// ---------------------------------------------------------------------------
// Curved solids: a closed 2D profile extruded along an axis
// ---------------------------------------------------------------------------

export type Axis = "x" | "y" | "z";
export type Profile = THREE.Vector2[];

/** Profile plane (U, V) and extrusion axis A; U x V = A for every axis. */
const BASES: Record<Axis, { U: THREE.Vector3; V: THREE.Vector3; A: THREE.Vector3 }> = {
  x: { U: new THREE.Vector3(0, 1, 0), V: new THREE.Vector3(0, 0, 1), A: new THREE.Vector3(1, 0, 0) },
  y: { U: new THREE.Vector3(1, 0, 0), V: new THREE.Vector3(0, 0, -1), A: new THREE.Vector3(0, 1, 0) },
  z: { U: new THREE.Vector3(1, 0, 0), V: new THREE.Vector3(0, 1, 0), A: new THREE.Vector3(0, 0, 1) },
};

/** Profile (u, v) extents and extrusion length of an axis-aligned box extruded along `axis`. */
function boxDims(size: THREE.Vector3, axis: Axis): [number, number, number] {
  if (axis === "x") return [size.y, size.z, size.x];
  if (axis === "y") return [size.x, size.z, size.y];
  return [size.x, size.y, size.z];
}

/** Drops repeated points and makes the winding counter-clockwise. */
function tidy(pts: Profile): Profile {
  const out: Profile = [];
  for (const p of pts) if (out.length === 0 || out[out.length - 1].distanceToSquared(p) > 1e-12) out.push(p);
  while (out.length > 2 && out[0].distanceToSquared(out[out.length - 1]) <= 1e-12) out.pop();
  if (THREE.ShapeUtils.area(out) < 0) out.reverse();
  return out;
}

function arc(out: Profile, cx: number, cy: number, r: number, a0: number, a1: number, seg: number): void {
  for (let i = 0; i <= seg; i++) {
    const a = a0 + ((a1 - a0) * i) / seg;
    out.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
}

/** w x h rectangle centred on the origin with corner radius r. */
function roundRectProfile(w: number, h: number, r: number, seg = 6): Profile {
  const rr = Math.min(Math.max(r, 0), w / 2, h / 2);
  const x = w / 2 - rr;
  const y = h / 2 - rr;
  if (rr <= 0) return tidy([new THREE.Vector2(x, -y), new THREE.Vector2(x, y), new THREE.Vector2(-x, y), new THREE.Vector2(-x, -y)]);
  const pts: Profile = [];
  arc(pts, x, -y, rr, -Math.PI / 2, 0, seg);
  arc(pts, x, y, rr, 0, Math.PI / 2, seg);
  arc(pts, -x, y, rr, Math.PI / 2, Math.PI, seg);
  arc(pts, -x, -y, rr, Math.PI, Math.PI * 1.5, seg);
  return tidy(pts);
}

const CORNERS = [
  [1, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
] as const;

/**
 * w x h rectangle centred on the origin with its own radius per corner,
 * ordered (+u,-v), (+u,+v), (-u,+v), (-u,-v); straight chamfers when `bevel`.
 */
function cornerProfile(w: number, h: number, radii: readonly number[], bevel = false, seg = 6): Profile {
  const pts: Profile = [];
  CORNERS.forEach(([su, sv], i) => {
    const r = Math.min(Math.max(radii[i] ?? 0, 0), w / 2, h / 2);
    const a0 = -Math.PI / 2 + (i * Math.PI) / 2;
    const cx = su * (w / 2 - r);
    const cy = sv * (h / 2 - r);
    arc(pts, cx, cy, r, a0, a0 + Math.PI / 2, r > 0 && !bevel ? seg : 1);
  });
  return tidy(pts);
}

/** Which `cornerProfile` corners face up (+y) for a box extruded along `axis`; none for "y". */
function upCorners(axis: Axis): boolean[] {
  const { U, V } = BASES[axis];
  return CORNERS.map(([su, sv]) => su * U.y + sv * V.y > 0);
}

/** w x h rectangle centred on the origin with 45-degree chamfers of size c. */
function chamferProfile(w: number, h: number, c: number): Profile {
  const cc = Math.min(Math.max(c, 0), w / 2 - 1e-4, h / 2 - 1e-4);
  const x = w / 2;
  const y = h / 2;
  const V2 = (u: number, v: number) => new THREE.Vector2(u, v);
  return tidy([
    V2(x - cc, -y), V2(x, -y + cc), V2(x, y - cc), V2(x - cc, y),
    V2(-x + cc, y), V2(-x, y - cc), V2(-x, -y + cc), V2(-x + cc, -y),
  ]);
}

function circleProfile(r: number, n = 32): Profile {
  const pts: Profile = [];
  arc(pts, 0, 0, r, 0, Math.PI * 2 * (1 - 1 / n), n - 1);
  return tidy(pts);
}

/**
 * Capsule from a circle of radius r0 at the origin to one of radius r1 at
 * (len, 0), joined by their outer tangent lines (a tapered robot-arm link).
 */
function capsuleProfile(len: number, r0: number, r1 = r0): Profile {
  const beta = Math.acos(Math.min(Math.max((r0 - r1) / len, -0.95), 0.95));
  const step = Math.PI / 14;
  const pts: Profile = [];
  arc(pts, len, 0, r1, -beta, beta, Math.max(2, Math.ceil((2 * beta) / step)));
  arc(pts, 0, 0, r0, beta, Math.PI * 2 - beta, Math.max(2, Math.ceil((Math.PI * 2 - 2 * beta) / step)));
  return tidy(pts);
}

/** Outward normal of the counter-clockwise edge a -> b. */
function edgeNormal(a: THREE.Vector2, b: THREE.Vector2): THREE.Vector2 {
  return new THREE.Vector2(b.y - a.y, a.x - b.x).normalize();
}

/** Miter-offsets every vertex inward by d (matches ExtrudeGeometry's bevel inset closely enough for lines). */
function insetProfile(P: Profile, d: number): Profile {
  const n = P.length;
  return P.map((p, i) => {
    const n0 = edgeNormal(P[(i + n - 1) % n], p);
    const n1 = edgeNormal(p, P[(i + 1) % n]);
    const k = d / Math.max(1 + n0.dot(n1), 0.2);
    return new THREE.Vector2(p.x - (n0.x + n1.x) * k, p.y - (n0.y + n1.y) * k);
  });
}

/** Turn angle above which a profile vertex is a hard crease (chamfers), not part of a curve. */
const CREASE_COS = Math.cos(THREE.MathUtils.degToRad(30));
const SIL_SCRATCH = new THREE.Vector3();

export interface PrismOpts {
  /** Depth of the soft rounded edge around both caps; the sides keep the full profile. */
  capRound?: number;
  /** Rotation about `center`, e.g. a tilt. */
  rotation?: THREE.Matrix4;
  /** Thin lines where a curved edge meets a flat face, so a large fillet still reads from the front. */
  tangents?: boolean;
}

/**
 * A profile extruded along an axis. Line art is drawn the way a curved solid
 * reads in a hidden-line drawing: cap outlines, hard creases, and silhouette
 * lines where the surface turns away from the viewer. Silhouettes depend on
 * the view direction, so pieces that rotate can recompute them per frame.
 */
class Prism {
  readonly U: THREE.Vector3;
  readonly V: THREE.Vector3;
  readonly A: THREE.Vector3;
  readonly outer: Profile;
  readonly inner: Profile | null;
  readonly cap: number;
  /** Half the length of the straight side walls. */
  readonly half: number;
  readonly halfLen: number;
  private readonly normals: THREE.Vector2[];
  private readonly creases: boolean[];
  private readonly tangents: boolean[];

  constructor(
    readonly center: THREE.Vector3,
    axis: Axis,
    profile: Profile,
    length: number,
    opts: PrismOpts = {},
  ) {
    const b = BASES[axis];
    this.U = b.U.clone();
    this.V = b.V.clone();
    this.A = b.A.clone();
    if (opts.rotation) {
      this.U.transformDirection(opts.rotation);
      this.V.transformDirection(opts.rotation);
      this.A.transformDirection(opts.rotation);
    }
    this.outer = tidy(profile);
    const n = this.outer.length;
    this.normals = this.outer.map((p, i) => edgeNormal(p, this.outer[(i + 1) % n]));
    this.creases = this.outer.map((_, i) => this.normals[(i + n - 1) % n].dot(this.normals[i]) < CREASE_COS);
    // A flat side meeting an arc shows up as a long edge next to a short one.
    this.tangents = this.outer.map((p, i) => {
      if (!opts.tangents || this.creases[i]) return false;
      const a = p.distanceTo(this.outer[(i + n - 1) % n]);
      const b = p.distanceTo(this.outer[(i + 1) % n]);
      return Math.max(a, b) > 2.5 * Math.min(a, b);
    });
    this.cap = Math.min(Math.max(opts.capRound ?? 0, 0), length * 0.45);
    this.inner = this.cap > 0 ? insetProfile(this.outer, this.cap) : null;
    this.halfLen = length / 2;
    this.half = length / 2 - this.cap;
  }

  at(p: THREE.Vector2, t: number, out = new THREE.Vector3()): THREE.Vector3 {
    return out.copy(this.center).addScaledVector(this.U, p.x).addScaledVector(this.V, p.y).addScaledVector(this.A, t);
  }

  private isSilhouette(i: number, du: number, dv: number): boolean {
    const n = this.normals.length;
    const a = this.normals[(i + n - 1) % n];
    const b = this.normals[i];
    return a.x * du + a.y * dv >= 0 !== b.x * du + b.y * dv >= 0;
  }

  private viewUV(view: THREE.Vector3): [number, number] | null {
    const du = view.dot(this.U);
    const dv = view.dot(this.V);
    return du * du + dv * dv < 1e-6 ? null : [du, dv];
  }

  /** Cap outlines and creases; with `view`, also the silhouettes for that (parent-frame) view direction. */
  outline(segs: Segs, detail = false, view?: THREE.Vector3): void {
    const ring = (P: Profile, t: number, d: boolean) => {
      for (let i = 0; i < P.length; i++) segs.push(d, this.at(P[i], t), this.at(P[(i + 1) % P.length], t));
    };
    for (const s of [-1, 1]) {
      ring(this.outer, s * this.half, detail);
      if (this.inner) ring(this.inner, s * this.halfLen, true);
    }
    const uv = view ? this.viewUV(view) : null;
    for (let i = 0; i < this.outer.length; i++) {
      const sil = uv !== null && this.isSilhouette(i, uv[0], uv[1]);
      if (!sil && !this.creases[i] && !this.tangents[i]) continue;
      segs.push(sil ? detail : true, this.at(this.outer[i], -this.half), this.at(this.outer[i], this.half));
    }
  }

  /**
   * Writes up to `max` silhouette segments into `arr` at segment `offset`;
   * unused slots collapse to the centre, inside the solid's fill.
   */
  silhouettesInto(view: THREE.Vector3, arr: Float32Array, offset: number, max: number): void {
    const uv = this.viewUV(view);
    let k = 0;
    const p = SIL_SCRATCH;
    if (uv) {
      for (let i = 0; i < this.outer.length && k < max; i++) {
        if (!this.isSilhouette(i, uv[0], uv[1])) continue;
        const o = (offset + k++) * 6;
        this.at(this.outer[i], -this.half, p).toArray(arr, o);
        this.at(this.outer[i], this.half, p).toArray(arr, o + 3);
      }
    }
    for (; k < max; k++) {
      const o = (offset + k) * 6;
      this.center.toArray(arr, o);
      this.center.toArray(arr, o + 3);
    }
  }

  fill(): THREE.BufferGeometry {
    const depth = Math.max(this.half * 2, 1e-4);
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(this.outer), {
      depth,
      steps: 1,
      curveSegments: 1,
      bevelEnabled: this.cap > 0,
      bevelThickness: this.cap,
      bevelSize: this.cap,
      bevelOffset: -this.cap,
      bevelSegments: 3,
    });
    g.translate(0, 0, -depth / 2);
    g.applyMatrix4(new THREE.Matrix4().makeBasis(this.U, this.V, this.A).setPosition(this.center));
    return g;
  }
}

export interface PieceOpts extends PrismOpts {
  detail?: boolean;
  fill?: boolean;
  /** View direction in the piece's parent frame; defaults to the scene's fixed view. */
  view?: THREE.Vector3;
}

/** Extruded profile with static silhouettes. Appends edges and returns the fill geometry. */
function prismPiece(
  segs: Segs,
  center: THREE.Vector3,
  axis: Axis,
  profile: Profile,
  length: number,
  opts: PieceOpts = {},
): THREE.BufferGeometry | null {
  const prism = new Prism(center, axis, profile, length, opts);
  prism.outline(segs, opts.detail ?? false, opts.view ?? VIEW_DIR);
  return opts.fill === false ? null : prism.fill();
}

export interface RoundBoxOpts extends PieceOpts {
  /** Fillet radius on the edges parallel to the axis. */
  round?: number;
  /** Radius on only the two upper edges along the axis (axis "x" or "z"); wins over `round` / `bevel`. */
  top?: number;
  /** Chamfer the upper edges instead of rounding them. */
  topBevel?: boolean;
  /** Chamfer size on the edges parallel to the axis (wins over `round`). */
  bevel?: number;
}

/** Box from centre + size whose edges along `axis` are filleted or chamfered. */
function roundBoxPiece(
  segs: Segs,
  center: THREE.Vector3,
  size: THREE.Vector3,
  axis: Axis,
  opts: RoundBoxOpts = {},
): THREE.BufferGeometry | null {
  const [w, h, length] = boxDims(size, axis);
  const profile = opts.top
    ? cornerProfile(w, h, upCorners(axis).map((up) => (up ? opts.top! : 0)), opts.topBevel)
    : opts.bevel
      ? chamferProfile(w, h, opts.bevel)
      : roundRectProfile(w, h, opts.round ?? 0);
  return prismPiece(segs, center, axis, profile, length, opts);
}

/** Cylinder from centre, axis, radius and length: cap circles plus view-facing silhouettes. */
function cylPiece(
  segs: Segs,
  center: THREE.Vector3,
  axis: Axis,
  radius: number,
  length: number,
  detail = false,
  fill = true,
  capRound = 0,
): THREE.BufferGeometry | null {
  return prismPiece(segs, center, axis, circleProfile(radius), length, { detail, fill, capRound });
}

export interface LoftSpec {
  /** Plan outline as (x, z) in metres; edge i runs from point i to point i + 1. */
  plan: THREE.Vector2[];
  y0: number;
  y1: number;
  /** Rounding of the top edges: radius plus a weight per plan edge (0 keeps that edge square). */
  top?: { r: number; w: readonly number[] };
  /** Rounding of the bottom edges, weighted the same way. */
  bottom?: { r: number; w: readonly number[] };
  detail?: boolean;
}

/** Quarter-circle steps used for a loft's rounded top / bottom edges. */
const LOFT_STEPS = 5;

/**
 * Vertical solid from a plan outline whose top and bottom edges are rounded
 * edge by edge, so a pod can curve on its open sides and stay square where it
 * couples to a neighbour. Edges are drawn as the top and bottom face
 * outlines, thin shoulder lines where a rounding meets the walls, and profile
 * lines through every ring at plan corners and silhouettes.
 */
function loftPiece(segs: Segs, spec: LoftSpec, fill = true): THREE.BufferGeometry | null {
  const n = spec.plan.length;
  const P = spec.plan.slice();
  let wT = spec.top ? spec.top.w.slice() : new Array<number>(n).fill(0);
  let wB = spec.bottom ? spec.bottom.w.slice() : new Array<number>(n).fill(0);
  if (THREE.ShapeUtils.area(P) < 0) {
    P.reverse();
    const remap = (w: number[]) => w.map((_, j) => w[(2 * n - 2 - j) % n]);
    wT = remap(wT);
    wB = remap(wB);
  }
  const N = P.map((p, i) => edgeNormal(p, P[(i + 1) % n]));

  /** Plan outline with each edge pushed inward by inset x its weight. */
  const ring = (inset: number, w: number[]) =>
    P.map((p, i) => {
      const a = (i + n - 1) % n;
      const n0 = N[a];
      const n1 = N[i];
      const d0 = inset * w[a];
      const d1 = inset * w[i];
      const det = n0.x * n1.y - n0.y * n1.x;
      if (Math.abs(det) > 0.5) {
        return new THREE.Vector2(p.x - (d0 * n1.y - d1 * n0.y) / det, p.y - (n0.x * d1 - n1.x * d0) / det);
      }
      const k = (d0 + d1) / 2 / (1 + n0.dot(n1));
      return new THREE.Vector2(p.x - (n0.x + n1.x) * k, p.y - (n0.y + n1.y) * k);
    });

  const rb = spec.bottom?.r ?? 0;
  const rt = spec.top?.r ?? 0;
  const rings: { y: number; pts: THREE.Vector2[] }[] = [];
  for (let k = 0; k <= (rb > 0 ? LOFT_STEPS : 0); k++) {
    const t = rb > 0 ? (k / LOFT_STEPS) * (Math.PI / 2) : Math.PI / 2;
    rings.push({ y: spec.y0 + rb * (1 - Math.cos(t)), pts: ring(rb * (1 - Math.sin(t)), wB) });
  }
  const topStart = rings.length;
  for (let k = 0; k <= (rt > 0 ? LOFT_STEPS : 0); k++) {
    const t = rt > 0 ? (k / LOFT_STEPS) * (Math.PI / 2) : 0;
    rings.push({ y: spec.y1 - rt + rt * Math.sin(t), pts: ring(rt * (1 - Math.cos(t)), wT) });
  }

  const at = (p: THREE.Vector2, y: number) => new THREE.Vector3(p.x, y, p.y);
  const d = spec.detail ?? false;
  const ringLine = (r: number, weight: boolean, w?: number[]) => {
    const { y, pts } = rings[r];
    for (let i = 0; i < n; i++) {
      if (w && w[i] < 0.05) continue;
      segs.push(weight, at(pts[i], y), at(pts[(i + 1) % n], y));
    }
  };
  ringLine(0, d);
  ringLine(rings.length - 1, d);
  if (rb > 0) ringLine(topStart - 1, true, wB);
  if (rt > 0) ringLine(topStart, true, wT);

  const du = VIEW_DIR.x;
  const dv = VIEW_DIR.z;
  const facing = (m: THREE.Vector2) => Math.sign(Math.round((m.x * du + m.y * dv) * 1e6));
  /** Facing split at 45 degrees, so wide plan curves also get a line where a side view would outline them. */
  const band = (m: THREE.Vector2) => {
    const s = (m.x * du + m.y * dv) / Math.hypot(du, dv);
    return facing(m) * (Math.abs(s) > Math.SQRT1_2 ? 2 : 1);
  };
  for (let i = 0; i < n; i++) {
    const a = N[(i + n - 1) % n];
    const b = N[i];
    const sil = facing(a) !== facing(b);
    const turn = a.dot(b);
    if (!sil && turn >= CREASE_COS && band(a) === band(b)) continue;
    const heavy = sil || turn < 0.5;
    for (let r = 0; r + 1 < rings.length; r++) {
      segs.push(heavy ? d : true, at(rings[r].pts[i], rings[r].y), at(rings[r + 1].pts[i], rings[r + 1].y));
    }
  }

  if (!fill) return null;
  const pos: number[] = [];
  const tri = (a: THREE.Vector2, ya: number, b: THREE.Vector2, yb: number, c: THREE.Vector2, yc: number) => {
    pos.push(a.x, ya, a.y, b.x, yb, b.y, c.x, yc, c.y);
  };
  for (let r = 0; r + 1 < rings.length; r++) {
    const lo = rings[r];
    const hi = rings[r + 1];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      tri(lo.pts[i], lo.y, lo.pts[j], lo.y, hi.pts[j], hi.y);
      tri(lo.pts[i], lo.y, hi.pts[j], hi.y, hi.pts[i], hi.y);
    }
  }
  for (const { y, pts } of [rings[0], rings[rings.length - 1]]) {
    for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(pts, [])) tri(pts[a], y, pts[b], y, pts[c], y);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

function mergeFills(fills: (THREE.BufferGeometry | null)[]): THREE.BufferGeometry | null {
  const list = fills
    .filter((g): g is THREE.BufferGeometry => g !== null)
    .map((g) => {
      if (!g.index) return g;
      const flat = g.toNonIndexed();
      g.dispose();
      return flat;
    });
  if (list.length === 0) return null;
  for (const g of list) {
    for (const name of Object.keys(g.attributes)) if (name !== "position") g.deleteAttribute(name);
    g.clearGroups();
  }
  const merged = mergeGeometries(list);
  for (const g of list) g.dispose();
  return merged;
}

/**
 * One pod part, built relative to its anchor: the part's (min x, min y,
 * front) corner. Geometry extends +x, +y and -z (toward the rear) from it, so
 * grow scaling along any axis extends from the part's natural start.
 */
export function buildPart(kit: Kit, part: Part, mats: LineMats): THREE.Group {
  const b = partBounds(part);
  const segs = new Segs();
  const fills = part.shapes.map((s: Shape) => {
    const center = new THREE.Vector3(
      (s.x + s.w / 2 - b.x) / 1000,
      (s.y + s.h / 2 - b.y) / 1000,
      -(s.z + s.d / 2 - b.z) / 1000,
    );
    const fill = !s.ghost;
    const cap = (s.cap ?? 0) / 1000;
    if (s.kind === "loft" && s.loft) {
      const { plan, top, topW, bottom, bottomW } = s.loft;
      const spec: LoftSpec = {
        plan: plan.map(([x, z]) => new THREE.Vector2((x - b.x) / 1000, -(z - b.z) / 1000)),
        y0: (s.y - b.y) / 1000,
        y1: (s.y + s.h - b.y) / 1000,
        top: top && topW ? { r: top / 1000, w: topW } : undefined,
        bottom: bottom && bottomW ? { r: bottom / 1000, w: bottomW } : undefined,
        detail: s.detail,
      };
      return loftPiece(segs, spec, fill);
    }
    if (s.kind === "box") {
      const size = new THREE.Vector3(s.w / 1000, s.h / 1000, s.d / 1000);
      const top = s.roundTop ?? s.bevelTop ?? 0;
      if (!s.round && !s.bevel && !top && !cap) return boxPiece(segs, center, size, s.detail, s.tilt ?? 0, fill);
      const axis = s.roundAxis ?? (s.w >= s.h && s.w >= s.d ? "x" : s.h >= s.d ? "y" : "z");
      return roundBoxPiece(segs, center, size, axis, {
        round: (s.round ?? 0) / 1000,
        bevel: (s.bevel ?? 0) / 1000,
        top: top / 1000,
        topBevel: s.bevelTop !== undefined,
        tangents: s.roundTop !== undefined,
        capRound: cap,
        detail: s.detail,
        fill,
        rotation: s.tilt ? new THREE.Matrix4().makeRotationX(s.tilt) : undefined,
      });
    }
    const axis = s.axis ?? "y";
    const length = (axis === "x" ? s.w : axis === "y" ? s.h : s.d) / 1000;
    const radius = (axis === "y" ? s.w : axis === "x" ? s.h : s.w) / 2000;
    return cylPiece(segs, center, axis, radius, length, s.detail, fill, cap);
  });
  return kit.solid(mergeFills(fills), segs, mats);
}

/** Large ground plane (hides anything below y = 0) plus a sparse floor grid. */
export function buildGround(kit: Kit, grid: LineMaterial): THREE.Group {
  const group = new THREE.Group();
  const plane = kit.track(new THREE.PlaneGeometry(400, 200));
  plane.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(plane, kit.fill);
  mesh.position.y = -0.002;
  group.add(mesh);
  const pts: number[] = [];
  for (let x = -100; x <= 160; x += 4) pts.push(x, 0, -16, x, 0, 16);
  for (let z = -16; z <= 16; z += 4) pts.push(-100, 0, z, 160, 0, z);
  const lines = kit.lines(pts, grid);
  if (lines) group.add(lines);
  return group;
}

/** Rounded floor pad outline with heavier corner arcs, marking a feeder / staging position. */
export function buildPad(kit: Kit, mats: LineMats, x: number, z: number, w: number, d: number): THREE.Group {
  const segs = new Segs();
  const y = 0.004;
  const seg = 8;
  const P = roundRectProfile(w, d, 0.4, seg);
  for (let i = 0; i < P.length; i++) {
    const a = P[i];
    const b = P[(i + 1) % P.length];
    // Straight sides are the only edges longer than an arc step.
    const side = a.distanceTo(b) > 0.2;
    segs.push(side, new THREE.Vector3(x + a.x, y, z + a.y), new THREE.Vector3(x + b.x, y, z + b.y));
  }
  return kit.solid(null, segs, mats);
}

export interface Belt {
  group: THREE.Group;
  /** Moving belt slats; set their x offset from the section's travel. */
  slats: THREE.Group;
  pitch: number;
}

/** One conveyor section between x0 and x1. */
export function buildBelt(kit: Kit, mats: LineMats, x0: number, x1: number): Belt {
  const group = new THREE.Group();
  const len = x1 - x0;
  const cx = (x0 + x1) / 2;
  const hw = BELT.halfWidth;
  const segs = new Segs();
  const fills: (THREE.BufferGeometry | null)[] = [];
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  fills.push(boxPiece(segs, V(cx, BELT_TOP - 0.03, 0), V(len, 0.06, hw * 2)));
  for (const z of [-hw, hw]) {
    fills.push(roundBoxPiece(segs, V(cx, BELT_TOP - 0.08, z), V(len, 0.24, 0.12), "x", { round: 0.045 }));
  }
  for (let x = x0 + 0.4; x < x1; x += 2.6) {
    for (const z of [-hw + 0.1, hw - 0.1]) {
      const size = V(0.12, BELT_TOP - 0.2, 0.12);
      fills.push(roundBoxPiece(segs, V(x, (BELT_TOP - 0.2) / 2, z), size, "y", { round: 0.04, detail: true }));
    }
  }
  for (const x of [x0, x1]) fills.push(cylPiece(segs, V(x, BELT_TOP - 0.1, 0), "z", 0.1, hw * 2, true, true, 0.025));
  group.add(kit.solid(mergeFills(fills), segs, mats));

  const pitch = 0.8;
  const slatPts: number[] = [];
  for (let x = x0 + 0.1; x < x1 - pitch; x += pitch) {
    slatPts.push(x, BELT_TOP + 0.004, -hw + 0.08, x, BELT_TOP + 0.004, hw - 0.08);
  }
  const slats = new THREE.Group();
  const slatLines = kit.lines(slatPts, mats.detail);
  if (slatLines) slats.add(slatLines);
  group.add(slats);
  return { group, slats, pitch };
}

export interface Arm {
  group: THREE.Group;
  setTarget(target: Readonly<Vec3>): void;
}

/** Silhouette slots per moving arm piece; a convex profile only ever needs two. */
const ARM_SIL = 4;

/** Curved gripper finger: a thin band along a bowed centre line, tip turned inward. */
function fingerProfile(side: number): Profile {
  const V2 = (x: number, y: number) => new THREE.Vector2(x, y);
  const curve = new THREE.QuadraticBezierCurve(V2(side * 0.12, -0.37), V2(side * 0.26, -0.48), V2(side * 0.045, -0.59));
  const n = 12;
  const a: Profile = [];
  const b: Profile = [];
  for (let i = 0; i <= n; i++) {
    const p = curve.getPoint(i / n);
    const t = curve.getTangent(i / n);
    const off = V2(-t.y, t.x).multiplyScalar(0.022);
    a.push(p.clone().add(off));
    b.push(p.clone().sub(off));
  }
  return [...a, ...b.reverse()];
}

/**
 * Cobot-style arm: capsule links on offset joint housings, a tapered forearm,
 * a two-knuckle wrist and curved gripper fingers. Driven as yaw + a planar
 * two-link chain with the wrist kept level. The links rotate, so each moving
 * piece's silhouettes are recomputed per frame from its local view direction.
 */
export function buildArm(kit: Kit, mats: LineMats, accent: LineMaterial, base: Readonly<Vec3>): Arm {
  const { shoulder: shoulderY, upper: L1, fore: L2, wrist: wristDrop } = ARM_LINKS;
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const circle = (r: number) => circleProfile(r, 36);

  const group = new THREE.Group();
  group.position.set(base[0], 0, base[2]);
  {
    const s = new Segs();
    const g = mergeFills([
      roundBoxPiece(s, V(0, 0.02, 0), V(1.5, 0.04, 1.5), "y", { round: 0.32, detail: true }),
      cylPiece(s, V(0, 0.075, 0), "y", 0.62, 0.07, true, true, 0.025),
      cylPiece(s, V(0, 0.36, 0), "y", 0.46, 0.5, false, true, 0.07),
    ]);
    group.add(kit.solid(g, s, mats));
  }

  const live: { node: THREE.Object3D; prisms: Prism[]; data: THREE.InterleavedBuffer | null }[] = [];
  const curved = (node: THREE.Object3D, prism: Prism, detail = false) => {
    const s = new Segs();
    prism.outline(s, detail);
    node.add(kit.solid(prism.fill(), s, mats));
    let entry = live.find((e) => e.node === node);
    if (!entry) live.push((entry = { node, prisms: [], data: null }));
    entry.prisms.push(prism);
  };
  /** Concentric motor-cover rings on a joint face (normal along z). */
  const cover = (node: THREE.Object3D, x: number, y: number, z: number, radii: number[]) => {
    const s = new Segs();
    for (const r of radii) {
      const P = circle(r);
      for (let i = 0; i < P.length; i++) {
        const q = P[(i + 1) % P.length];
        s.push(true, V(x + P[i].x, y + P[i].y, z), V(x + q.x, y + q.y, z));
      }
    }
    node.add(kit.solid(null, s, mats));
  };

  const turret = new THREE.Group();
  turret.position.y = 0.61;
  group.add(turret);
  const sy = shoulderY - turret.position.y;
  curved(turret, new Prism(V(0, 0.24, 0), "y", circle(0.4), 0.48, { capRound: 0.1 }));
  curved(turret, new Prism(V(0, 0.46, 0), "z", roundRectProfile(0.6, 0.38, 0.17), 0.46, { capRound: 0.04 }));
  curved(turret, new Prism(V(0, sy, 0), "z", circle(0.34), 0.52, { capRound: 0.07 }));
  for (const z of [-0.262, 0.262]) cover(turret, 0, sy, z, [0.2, 0.11]);

  // Upper arm sits beside the shoulder and forearm planes (+z); the forearm returns to z = 0.
  const upperZ = 0.43;
  const upperT = 0.34;
  const shoulder = new THREE.Group();
  shoulder.position.y = sy;
  turret.add(shoulder);
  curved(shoulder, new Prism(V(0, 0, upperZ), "z", capsuleProfile(L1, 0.3, 0.26), upperT, { capRound: 0.08 }));
  const face = upperZ + upperT / 2 + 0.003;
  cover(shoulder, 0, 0, face, [0.18, 0.1]);
  {
    const pts: number[] = [];
    for (const z of [face, upperZ - upperT / 2 - 0.003]) {
      for (const y of [-0.022, 0.022]) pts.push(0.75, y, z, L1 - 1.05, y, z);
      pts.push(L1 - 0.86, 0, z, L1 - 0.74, 0, z);
    }
    const stripe = kit.lines(pts, accent);
    if (stripe) shoulder.add(stripe);
  }

  const elbow = new THREE.Group();
  elbow.position.x = L1;
  shoulder.add(elbow);
  curved(elbow, new Prism(V(0, 0, 0.225), "z", circle(0.29), 0.8, { capRound: 0.07 }));
  for (const z of [-0.177, 0.627]) cover(elbow, 0, 0, z, [0.17, 0.09]);
  curved(elbow, new Prism(V(0, 0, 0), "z", capsuleProfile(L2, 0.23, 0.16), 0.28, { capRound: 0.07 }));

  const wrist = new THREE.Group();
  wrist.position.x = L2;
  elbow.add(wrist);
  curved(wrist, new Prism(V(0, 0, 0), "z", circle(0.18), 0.36, { capRound: 0.05 }));
  for (const z of [-0.182, 0.182]) cover(wrist, 0, 0, z, [0.1]);
  curved(wrist, new Prism(V(0, -0.17, 0), "y", circle(0.14), 0.2, { capRound: 0.04 }));
  curved(wrist, new Prism(V(0, -0.29, 0), "y", circle(0.17), 0.04, { capRound: 0.012 }), true);
  curved(wrist, new Prism(V(0, -0.345, 0), "z", roundRectProfile(0.36, 0.07, 0.03), 0.2));
  for (const side of [-1, 1]) curved(wrist, new Prism(V(0, 0, 0), "z", fingerProfile(side), 0.12));

  for (const e of live) {
    const lines = kit.lines(new Float32Array(e.prisms.length * ARM_SIL * 6), mats.struct)!;
    lines.frustumCulled = false;
    e.node.add(lines);
    e.data = (lines.geometry.getAttribute("instanceStart") as THREE.InterleavedBufferAttribute).data;
  }
  const q = new THREE.Quaternion();
  const view = new THREE.Vector3();
  const refreshSilhouettes = () => {
    for (const e of live) {
      e.node.getWorldQuaternion(q);
      view.copy(VIEW_DIR).applyQuaternion(q.invert());
      const arr = e.data!.array as Float32Array;
      for (let i = 0; i < e.prisms.length; i++) e.prisms[i].silhouettesInto(view, arr, i * ARM_SIL, ARM_SIL);
      e.data!.needsUpdate = true;
    }
  };

  const sx = base[0];
  const sz = base[2];
  return {
    group,
    setTarget([tx, ty, tz]) {
      const dx = tx - sx;
      const dz = tz - sz;
      const r = Math.hypot(dx, dz);
      const dy = ty + wristDrop - shoulderY;
      const D = Math.min(Math.max(Math.hypot(r, dy), 0.4), L1 + L2 - 0.001);
      const a = Math.atan2(dy, r) + Math.acos((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D));
      const b = Math.acos((L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2));
      const elbowRel = -(Math.PI - b);
      turret.rotation.y = Math.atan2(-dz, dx);
      shoulder.rotation.z = a;
      elbow.rotation.z = elbowRel;
      wrist.rotation.z = -(a + elbowRel);
      refreshSilhouettes();
    },
  };
}

export interface Gantry {
  group: THREE.Group;
  setHook(hook: Readonly<Vec3>): void;
}

/** Portal gantry spanning the build bay: fixed legs and rails, a travelling bridge, trolley and hook. */
export function buildGantry(kit: Kit, mats: LineMats): Gantry {
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const [x0, x1] = GANTRY.x;
  const [z0, z1] = GANTRY.z;
  const H = GANTRY.railY;
  const segs = new Segs();
  const fills: (THREE.BufferGeometry | null)[] = [];
  for (const x of [x0, x1]) {
    for (const z of [z0, z1]) {
      fills.push(roundBoxPiece(segs, V(x, H / 2, z), V(0.3, H, 0.3), "y", { round: 0.09, detail: z === z1 }));
    }
    fills.push(roundBoxPiece(segs, V(x, H + 0.15, 0), V(0.36, 0.3, z1 - z0 + 0.36), "z", { bevel: 0.06 }));
  }
  for (const z of [z0, z1]) {
    fills.push(roundBoxPiece(segs, V(0, H + 0.2, z), V(x1 - x0 + 0.36, 0.4, 0.36), "x", { bevel: 0.07 }));
  }
  const group = new THREE.Group();
  group.add(kit.solid(mergeFills(fills), segs, mats));

  const bridge = new THREE.Group();
  group.add(bridge);
  {
    const s = new Segs();
    const g = roundBoxPiece(s, V(0, H + 0.62, 0), V(0.55, 0.44, z1 - z0 + 0.2), "z", { bevel: 0.08 });
    bridge.add(kit.solid(g, s, mats));
  }

  const trolley = new THREE.Group();
  bridge.add(trolley);
  {
    const s = new Segs();
    const g = mergeFills([
      roundBoxPiece(s, V(0, H + 0.2, 0), V(0.95, 0.4, 0.95), "y", { round: 0.16, capRound: 0.05 }),
      cylPiece(s, V(0, H - 0.05, 0), "z", 0.18, 0.7, true, true, 0.03),
    ]);
    trolley.add(kit.solid(g, s, mats));
  }

  const cable = new THREE.Group();
  cable.position.y = H - 0.1;
  trolley.add(cable);
  {
    const s = new Segs();
    s.push(true, V(-0.08, 0, 0), V(-0.08, -1, 0));
    s.push(true, V(0.08, 0, 0), V(0.08, -1, 0));
    cable.add(kit.solid(null, s, mats));
  }

  // Hook block on a shackle loop over a rounded spreader bar; the block top is where the cable ends.
  const blockTop = 0.58;
  const hook = new THREE.Group();
  trolley.add(hook);
  {
    const s = new Segs();
    const g = mergeFills([
      roundBoxPiece(s, V(0, 0.45, 0), V(0.5, 0.26, 0.5), "y", { round: 0.14, capRound: 0.05 }),
      roundBoxPiece(s, V(0, 0.1, 0), V(0.9, 0.08, 0.16), "x", { round: 0.035, detail: true, capRound: 0.02 }),
    ]);
    const n = 24;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      s.push(false, V(Math.cos(a0) * 0.08, 0.23 + Math.sin(a0) * 0.095, 0), V(Math.cos(a1) * 0.08, 0.23 + Math.sin(a1) * 0.095, 0));
    }
    hook.add(kit.solid(g, s, mats));
  }

  return {
    group,
    setHook([hx, hy, hz]) {
      bridge.position.x = Math.min(Math.max(hx, x0 + 0.5), x1 - 0.5);
      trolley.position.z = hz;
      hook.position.y = hy;
      cable.scale.y = Math.max(0.01, H - 0.1 - (hy + blockTop));
    },
  };
}

// ---------------------------------------------------------------------------
// Outer shell (the gabled ZODE chassis from /zode_3D.bin)
// ---------------------------------------------------------------------------

/**
 * Shell layer groups in build order. Lines-only groups read as glazing / open
 * framing; the translucent roof is drawn last so the pods inside stay visible,
 * dimmed, like a cutaway.
 */
export const SHELL_LAYERS: { ids: string[]; fill: boolean; translucent?: boolean }[] = [
  { ids: ["base.foundation", "base.deck"], fill: true },
  { ids: ["walls.left", "walls.right"], fill: false },
  { ids: ["glazing.front", "glazing.back"], fill: false },
  { ids: ["roof.eaves", "roof.left", "roof.right", "roof.ridge"], fill: true, translucent: true },
];

export interface Shell {
  group: THREE.Group;
  layers: THREE.Group[];
  /** World-space [bottom, top] of each layer group, for the rising build clip. */
  yRanges: [number, number][];
}

/**
 * Places the shell over the end of the line, rotated so its gable-to-gable
 * axis runs along the conveyor and uniformly scaled so the three coupled pods
 * fit inside its walls and under its eaves, floor deck flush with the belt.
 */
export function buildShell(
  kit: Kit,
  model: CabinLayers,
  mats: LineMats[],
  fills: THREE.Material[],
): Shell {
  const roofBox = new THREE.Box3();
  for (const id of SHELL_LAYERS[3].ids) {
    const g = model.solids[id];
    if (!g) continue;
    g.computeBoundingBox();
    roofBox.union(g.boundingBox!);
  }
  const bodyLen = roofBox.max.z - roofBox.min.z;
  const cx = (roofBox.min.x + roofBox.max.x) / 2;
  const cz = (roofBox.min.z + roofBox.max.z) / 2;
  const rowLen = (3 * POD_PITCH * 1000 - POD.joint + 2 * END_CAP) / 1000;
  const podHeight = (POD.height + 1600) / 1000;
  const k = Math.max((rowLen + 1.8) / (bodyLen * 0.92), podHeight / (model.eaveY - model.floorY));

  const group = new THREE.Group();
  group.scale.setScalar(k);
  group.rotation.y = Math.PI / 2;
  group.position.set(SHELL_X - k * cz, BELT_TOP - k * model.floorY, k * cx);

  const layers: THREE.Group[] = [];
  const yRanges: [number, number][] = SHELL_LAYERS.map((layer, i) => {
    const sub = new THREE.Group();
    layers.push(sub);
    const box = new THREE.Box3();
    for (const id of layer.ids) {
      const solid = model.solids[id];
      const edges = model.edges[id];
      if (!solid || !edges) continue;
      solid.computeBoundingBox();
      box.union(solid.boundingBox!);
      // The solid geometry is owned by the shared model cache, so it is not tracked for disposal.
      if (layer.fill) {
        const mesh = new THREE.Mesh(solid, fills[i]);
        if (layer.translucent) mesh.renderOrder = 5;
        sub.add(mesh);
      }
      for (const lines of [kit.lines(edges.struct, mats[i].struct), kit.lines(edges.detail, mats[i].detail)]) {
        if (!lines) continue;
        if (layer.translucent) lines.renderOrder = 6;
        sub.add(lines);
      }
    }
    group.add(sub);
    return [group.position.y + box.min.y * k, group.position.y + box.max.y * k];
  });

  return { group, layers, yRanges };
}
