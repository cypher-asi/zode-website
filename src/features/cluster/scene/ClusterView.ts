import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LAYER_OF, RACK, RAILS, rackHeight } from "../model/catalog";
import type { ClusterModel, Layer, Rack } from "../model/types";
import { Buffers, drawRack, partAt, partBox, toObjects, type Palette } from "./geometry";
import { RAIL_COLORS } from "./palette";

/*
 * The cluster builder's 3D viewport, kept out of React: one renderer, camera and
 * set of orbit controls for the life of the page, and a scene rebuilt from
 * the model whenever it changes. Frames are only drawn while something moves.
 */

export interface Pick {
  rackId: string;
  partId: string | null;
}

export type ViewPreset = "iso" | "front" | "top";

export interface ViewState {
  model: ClusterModel;
  hidden: ReadonlySet<Layer>;
  cables: boolean;
  rail: number | null;
  /** A layer to outline, previewing what a hovered control changes. */
  focus: Layer | null;
  selected: Pick | null;
}

export interface ViewCallbacks {
  onHover: (pick: Pick | null, x: number, y: number) => void;
  onSelect: (pick: Pick | null) => void;
}

const FOV = 30;
const DIRECTIONS: Record<ViewPreset, THREE.Vector3> = {
  iso: new THREE.Vector3(0.85, 0.8, 1.15).normalize(),
  front: new THREE.Vector3(0, 0.22, 1).normalize(),
  top: new THREE.Vector3(0, 1, 0.02).normalize(),
};
const TWEEN_MS = 650;
const RISE_MS = 520;
const CLICK_PX = 5;

const ease = (t: number) => 1 - (1 - t) ** 3;

interface Tween {
  start: number;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
}

interface RackObject {
  rack: Rack;
  group: THREE.Group;
  mesh: THREE.Mesh | null;
  ranges: Buffers["ranges"];
  /** Rise-in start time, or null once settled. */
  rise: number | null;
}

/** Disposable geometry and materials for one build of a part of the scene. */
class Batch {
  readonly group = new THREE.Group();
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];

  track = (g: THREE.BufferGeometry) => {
    this.geometries.push(g);
  };

  material<M extends THREE.Material>(m: M): M {
    this.materials.push(m);
    return m;
  }

  dispose() {
    this.group.removeFromParent();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}

function readPalette(el: HTMLElement) {
  const style = getComputedStyle(el);
  const token = (name: string, fallback: string) => new THREE.Color(style.getPropertyValue(name).trim() || fallback);
  return {
    bg: token("--color-paper", "white"),
    grid: token("--color-border", "lightgray"),
    gridStrong: token("--color-border-strong", "silver"),
    accent: token("--color-accent-strong", "orange"),
    accentSoft: token("--color-accent-soft", "peachpuff"),
    muted: token("--color-text-tertiary", "gray"),
    scene: {
      fill: token("--color-white", "white"),
      rack: token("--color-text-secondary", "dimgray"),
      layers: {
        compute: token("--color-ink", "black"),
        network: token("--color-info", "royalblue"),
        storage: token("--color-violet", "blueviolet"),
        management: token("--color-success", "seagreen"),
        rack: token("--color-text-secondary", "dimgray"),
      },
    } satisfies Palette,
  };
}

export class ClusterView {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 500);
  private readonly controls: OrbitControls;
  private readonly palette: ReturnType<typeof readPalette>;
  private readonly reduced: boolean;
  private readonly raycaster = new THREE.Raycaster();
  private readonly fillMat: THREE.MeshLambertMaterial;
  private readonly structMat: LineMaterial;
  private readonly detailMat: LineMaterial;
  private readonly observer: ResizeObserver;
  private readonly visibility: IntersectionObserver;

  private state: ViewState | null = null;
  /** False while the viewport is scrolled out of view; frames wait until it returns. */
  private visible = true;
  private racks: RackObject[] = [];
  private rackBatch: Batch | null = null;
  private floorBatch: Batch | null = null;
  private cableBatch: Batch | null = null;
  private cableMats: LineMaterial[] = [];
  private highlightBatch: Batch | null = null;
  private hovered: Pick | null = null;
  private frameKey = "";
  /** Height of the band between the floating panels, where framing aims. */
  private clearHeight = 1;
  /** Set once the viewer orbits or zooms, so a resize stops re-fitting the view. */
  private userMoved = false;
  private tween: Tween | null = null;
  private raf = 0;
  private down: { x: number; y: number } | null = null;
  private width = 1;
  private height = 1;

  constructor(
    private readonly container: HTMLElement,
    private readonly callbacks: ViewCallbacks,
  ) {
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.palette = readPalette(container);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.5 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.setAttribute("aria-hidden", "true");
    container.appendChild(this.renderer.domElement);

    this.scene.background = this.palette.bg;
    // Even, slightly top-lit shading: roofs read lightest, the sides a step down.
    this.scene.add(new THREE.HemisphereLight(this.palette.scene.fill, this.palette.gridStrong, 2.1));
    const sun = new THREE.DirectionalLight(this.palette.scene.fill, 0.9);
    sun.position.set(4, 10, 6);
    this.scene.add(sun);

    this.fillMat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    this.structMat = new LineMaterial({ vertexColors: true, linewidth: 1.1 });
    this.detailMat = new LineMaterial({ vertexColors: true, linewidth: 0.6, transparent: true, opacity: 0.75 });

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 160;
    this.controls.addEventListener("start", () => {
      this.tween = null;
      this.userMoved = true;
    });
    this.controls.addEventListener("change", () => this.invalidate());

    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.visibility = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (this.visible) {
        this.invalidate();
      } else {
        cancelAnimationFrame(this.raf);
        this.raf = 0;
      }
    });
    this.visibility.observe(container);
    this.resize();
  }

  setState(next: ViewState) {
    const prev = this.state;
    this.state = next;
    const modelChanged = prev?.model !== next.model;
    if (modelChanged || prev?.hidden !== next.hidden) this.buildRacks(!prev);
    if (modelChanged) this.buildFloor();
    if (modelChanged || prev?.cables !== next.cables) this.buildCables();
    if (modelChanged || prev?.rail !== next.rail || prev?.cables !== next.cables) this.styleCables();
    this.buildHighlight();

    // Re-frame when the footprint changes, or on a new selection.
    const sel = next.selected;
    const key = sel ? `sel:${sel.rackId}` : `all:${next.model.stats.rows}:${Math.min(next.model.racks.length, next.model.config.rowLength)}:${next.model.config.rackU}`;
    if (key !== this.frameKey) {
      const instant = !prev;
      this.frameKey = key;
      if (sel) this.frameRack(sel.rackId);
      else this.frame(this.currentDirection(), instant);
    }
    this.invalidate();
  }

  setView(preset: ViewPreset) {
    const sel = this.state?.selected;
    if (sel) this.frameRack(sel.rackId, DIRECTIONS[preset]);
    else this.frame(DIRECTIONS[preset]);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    this.visibility.disconnect();
    this.controls.dispose();
    for (const b of [this.rackBatch, this.floorBatch, this.cableBatch, this.highlightBatch]) b?.dispose();
    this.fillMat.dispose();
    this.structMat.dispose();
    this.detailMat.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // --- Building ------------------------------------------------------------

  private buildRacks(first: boolean) {
    const state = this.state!;
    const known = new Set(this.racks.map((r) => r.rack.id));
    this.rackBatch?.dispose();
    const batch = new Batch();
    const now = performance.now();
    this.racks = state.model.racks.map((rack, i) => {
      const b = new Buffers();
      drawRack(b, rack, this.palette.scene, state.hidden);
      const { mesh, lines } = toObjects(b, this.fillMat, this.structMat, this.detailMat, batch.track);
      const group = new THREE.Group();
      if (mesh) {
        mesh.userData.rackIndex = i;
        group.add(mesh);
      }
      group.add(...lines);
      group.position.set(rack.x, 0, rack.z);
      group.rotation.y = rack.facing === 1 ? 0 : Math.PI;
      batch.group.add(group);
      const isNew = !known.has(rack.id) && !this.reduced;
      // The first build rises in rack by rack; later ones only animate what was added.
      const delay = first ? i * 18 : 0;
      const rise = isNew ? now + Math.min(delay, 600) : null;
      if (rise !== null) group.scale.y = 0.0001;
      return { rack, group, mesh, ranges: b.ranges, rise };
    });
    this.scene.add(batch.group);
    this.rackBatch = batch;
  }

  /** Raised-floor tiles under the cluster and an overhead tray along each row. */
  private buildFloor() {
    const { model } = this.state!;
    this.floorBatch?.dispose();
    const batch = new Batch();
    const { minX, maxX, minZ, maxZ } = this.bounds();
    const tile = 0.6;
    const pad = 2.4;
    const x0 = Math.floor((minX - pad) / tile) * tile;
    const x1 = Math.ceil((maxX + pad) / tile) * tile;
    const z0 = Math.floor((minZ - pad) / tile) * tile;
    const z1 = Math.ceil((maxZ + pad) / tile) * tile;
    const grid: number[] = [];
    for (let x = x0; x <= x1 + 1e-6; x += tile) grid.push(x, 0, z0, x, 0, z1);
    for (let z = z0; z <= z1 + 1e-6; z += tile) grid.push(x0, 0, z, x1, 0, z);
    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute("position", new THREE.Float32BufferAttribute(grid, 3));
    batch.track(gridGeo);
    batch.group.add(
      new THREE.LineSegments(gridGeo, batch.material(new THREE.LineBasicMaterial({ color: this.palette.grid }))),
    );

    // Trays: one along each row, and a spine tray across all rows at the network racks.
    const trays: number[] = [];
    const trayBox = (ax: number, az: number, bx: number, bz: number, w: number) => {
      const y0 = model.trayY - 0.06;
      const y1 = model.trayY + 0.04;
      const alongX = Math.abs(bx - ax) >= Math.abs(bz - az);
      const [xa, xb] = alongX ? [Math.min(ax, bx), Math.max(ax, bx)] : [ax - w / 2, ax + w / 2];
      const [za, zb] = alongX ? [az - w / 2, az + w / 2] : [Math.min(az, bz), Math.max(az, bz)];
      for (const y of [y0, y1]) {
        trays.push(xa, y, za, xb, y, za, xa, y, zb, xb, y, zb, xa, y, za, xa, y, zb, xb, y, za, xb, y, zb);
      }
    };
    const rows = new Map<number, Rack[]>();
    for (const r of model.racks) rows.set(r.row, [...(rows.get(r.row) ?? []), r]);
    for (const racks of rows.values()) {
      const xs = racks.map((r) => r.x);
      trayBox(Math.min(...xs) - RACK.width / 2, racks[0].z, Math.max(...xs) + RACK.width / 2, racks[0].z, 0.6);
    }
    if (rows.size > 1) trayBox(this.spineX(), minZ, this.spineX(), maxZ, 0.6);
    const trayGeo = new THREE.BufferGeometry();
    trayGeo.setAttribute("position", new THREE.Float32BufferAttribute(trays, 3));
    batch.track(trayGeo);
    batch.group.add(
      new THREE.LineSegments(trayGeo, batch.material(new THREE.LineBasicMaterial({ color: this.palette.muted }))),
    );
    this.scene.add(batch.group);
    this.floorBatch = batch;
  }

  /** Where the cross-row tray runs: over the middle of the network racks. */
  private spineX(): number {
    const net = this.state!.model.racks.filter((r) => r.kind === "network");
    return net.reduce((s, r) => s + r.x, 0) / Math.max(1, net.length);
  }

  /**
   * Fabric cables: every rail from every node up to the tray, along it and
   * across to its leaf, offset by rail so the eight rails read as ribbons.
   * Leaf-to-spine runs ride a little higher.
   */
  private buildCables() {
    const { model, cables } = this.state!;
    this.cableBatch?.dispose();
    this.cableBatch = null;
    this.cableMats = [];
    if (!cables) return;
    const batch = new Batch();
    const byId = new Map(model.racks.map((r) => [r.id, r]));
    const xs = this.spineX();
    const segs: number[][] = Array.from({ length: RAILS + 1 }, () => []);
    const route = (out: number[], a: Rack, b: Rack, y: number, off: number, ja: number, jb: number) => {
      const ha = rackHeight(a.uHeight);
      const hb = rackHeight(b.uHeight);
      const pts: THREE.Vector3Tuple[] = [[a.x + ja, ha, a.z + off]];
      pts.push([a.x + ja, y, a.z + off]);
      if (a.row !== b.row) {
        pts.push([xs + off, y, a.z + off]);
        pts.push([xs + off, y, b.z + off]);
      }
      pts.push([b.x + jb, y, b.z + off]);
      pts.push([b.x + jb, hb, b.z + off]);
      for (let i = 1; i < pts.length; i++) out.push(...pts[i - 1], ...pts[i]);
    };
    const slotOf = new Map<string, number>();
    for (const r of model.racks) r.parts.forEach((p, i) => slotOf.set(p.id, i));
    for (const l of model.hostLinks) {
      const a = byId.get(l.rackId)!;
      const b = byId.get(l.leafRackId)!;
      const off = (l.rail - (RAILS - 1) / 2) * 0.045;
      const ja = ((slotOf.get(l.partId)! % 6) - 2.5) * 0.04;
      const jb = ((slotOf.get(l.leafId)! % 6) - 2.5) * 0.04;
      route(segs[l.rail], a, b, model.trayY, off, ja, jb);
    }
    for (const u of model.uplinks) {
      const a = byId.get(u.leafRackId)!;
      const b = byId.get(u.spineRackId)!;
      const ja = ((slotOf.get(u.leafId)! % 6) - 2.5) * 0.04;
      const jb = ((slotOf.get(u.spineId)! % 6) - 2.5) * 0.04;
      route(segs[RAILS], a, b, model.trayY + 0.22, 0, ja, jb);
    }
    segs.forEach((s, i) => {
      const mat = batch.material(
        new LineMaterial({
          color: i < RAILS ? new THREE.Color(RAIL_COLORS[i]) : this.palette.scene.layers.network,
          linewidth: 1,
          transparent: true,
        }),
      );
      this.cableMats.push(mat);
      if (!s.length) return;
      const g = new LineSegmentsGeometry();
      g.setPositions(s);
      batch.track(g);
      batch.group.add(new LineSegments2(g, mat));
    });
    this.scene.add(batch.group);
    this.cableBatch = batch;
  }

  private styleCables() {
    const rail = this.state!.rail;
    this.cableMats.forEach((m, i) => {
      const on = rail === null || rail === i;
      m.opacity = on ? (i < RAILS ? 0.85 : 0.5) : 0.08;
      m.linewidth = rail !== null && on ? 1.8 : 1;
    });
  }

  /** Accent outlines: the selected and hovered parts, and every part on the previewed layer. */
  private buildHighlight() {
    const { model, focus, selected, hidden } = this.state!;
    this.highlightBatch?.dispose();
    const batch = new Batch();
    const strong: number[] = [];
    const soft: number[] = [];
    const tints: THREE.Matrix4[] = [];
    const byId = new Map(this.racks.map((r) => [r.rack.id, r]));
    const m = new THREE.Matrix4();
    const outline = (out: number[], rack: Rack, box: number[], tint: boolean) => {
      const obj = byId.get(rack.id);
      if (!obj) return;
      obj.group.updateMatrix();
      const [x0, y0, z0, x1, y1, z1] = box;
      const c = (i: number) =>
        new THREE.Vector3(i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0).applyMatrix4(obj.group.matrix);
      for (const [a, b] of [
        [0, 1], [1, 3], [3, 2], [2, 0], [4, 5], [5, 7], [7, 6], [6, 4], [0, 4], [1, 5], [2, 6], [3, 7],
      ]) {
        const pa = c(a);
        const pb = c(b);
        out.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
      }
      if (tint) {
        m.makeTranslation((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
          .scale(new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0))
          .premultiply(obj.group.matrix);
        tints.push(m.clone());
      }
    };
    const w = RACK.width / 2 + 0.01;
    const d = RACK.depth / 2 + 0.01;
    const target = (pick: Pick, out: number[], tint: boolean) => {
      const rack = model.racks.find((r) => r.id === pick.rackId);
      if (!rack) return;
      const part = pick.partId ? rack.parts.find((p) => p.id === pick.partId) : null;
      if (part) outline(out, rack, grow(partBox(part), 0.006), tint);
      else outline(out, rack, [-w, 0, -d, w, rackHeight(rack.uHeight) + 0.01, d], false);
    };

    if (focus && !hidden.has(focus)) {
      for (const rack of model.racks) {
        for (const part of rack.parts) {
          if (LAYER_OF[part.kind] === focus) outline(soft, rack, grow(partBox(part), 0.004), false);
        }
      }
    }
    if (this.hovered) target(this.hovered, soft, false);
    if (selected) target(selected, strong, true);

    const add = (segs: number[], width: number, opacity: number) => {
      if (!segs.length) return;
      const g = new LineSegmentsGeometry();
      g.setPositions(segs);
      batch.track(g);
      const mat = batch.material(
        new LineMaterial({ color: this.palette.accent, linewidth: width, transparent: true, opacity, depthTest: false }),
      );
      const lines = new LineSegments2(g, mat);
      lines.renderOrder = 10;
      batch.group.add(lines);
    };
    add(soft, 1.2, 0.6);
    add(strong, 2.2, 1);
    if (tints.length) {
      const g = new THREE.BoxGeometry(1, 1, 1);
      batch.track(g);
      const mat = batch.material(
        new THREE.MeshBasicMaterial({ color: this.palette.accentSoft, transparent: true, opacity: 0.45, depthWrite: false }),
      );
      for (const t of tints) {
        const mesh = new THREE.Mesh(g, mat);
        mesh.applyMatrix4(t);
        mesh.renderOrder = 9;
        batch.group.add(mesh);
      }
    }
    this.scene.add(batch.group);
    this.highlightBatch = batch;
  }

  // --- Camera ----------------------------------------------------------------

  private bounds() {
    const racks = this.state!.model.racks;
    const xs = racks.map((r) => r.x);
    const zs = racks.map((r) => r.z);
    const h = rackHeight(this.state!.model.config.rackU);
    return {
      minX: Math.min(...xs) - RACK.width / 2,
      maxX: Math.max(...xs) + RACK.width / 2,
      minZ: Math.min(...zs) - RACK.depth / 2,
      maxZ: Math.max(...zs) + RACK.depth / 2,
      height: h + 0.6,
    };
  }

  private currentDirection(): THREE.Vector3 {
    if (this.camera.position.lengthSq() === 0) return DIRECTIONS.iso;
    return this.camera.position.clone().sub(this.controls.target).normalize();
  }

  /** Distance at which a sphere of `radius` fills the view. */
  private fitDistance(radius: number): number {
    const half = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const v = Math.atan(half * (this.clearHeight / this.height));
    const h = Math.atan(half * (this.width / this.height));
    return (radius * 1.08) / Math.sin(Math.min(v, h));
  }

  private frame(dir: THREE.Vector3, instant = false) {
    const { minX, maxX, minZ, maxZ, height } = this.bounds();
    const center = new THREE.Vector3((minX + maxX) / 2, height * 0.35, (minZ + maxZ) / 2);
    const radius = Math.hypot(maxX - minX, maxZ - minZ, height) / 2;
    this.moveTo(center, center.clone().addScaledVector(dir, this.fitDistance(radius)), instant);
  }

  private frameRack(rackId: string, dir = this.currentDirection()) {
    const rack = this.state!.model.racks.find((r) => r.id === rackId);
    if (!rack) return;
    const h = rackHeight(rack.uHeight);
    const center = new THREE.Vector3(rack.x, h / 2, rack.z);
    // Look at the front of the rack, whichever way it faces.
    const d = dir.clone();
    if (Math.sign(d.z) !== rack.facing && Math.abs(d.z) > 0.05) d.z = -d.z;
    this.moveTo(center, center.clone().addScaledVector(d, this.fitDistance(h)));
  }

  private moveTo(target: THREE.Vector3, pos: THREE.Vector3, instant = false) {
    this.userMoved = false;
    if (instant || this.reduced) {
      this.tween = null;
      this.controls.target.copy(target);
      this.camera.position.copy(pos);
      this.controls.update();
    } else {
      this.tween = {
        start: performance.now(),
        fromTarget: this.controls.target.clone(),
        toTarget: target,
        fromPos: this.camera.position.clone(),
        toPos: pos,
      };
    }
    this.invalidate();
  }

  // --- Picking ---------------------------------------------------------------

  private pick(event: PointerEvent): Pick | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const meshes = this.racks.flatMap((r) => (r.mesh ? [r.mesh] : []));
    const hit = this.raycaster.intersectObjects(meshes, false)[0];
    if (!hit || hit.faceIndex == null) return null;
    const obj = this.racks[hit.object.userData.rackIndex as number];
    return { rackId: obj.rack.id, partId: partAt(obj.ranges, hit.faceIndex) };
  }

  private setHovered(pick: Pick | null, x: number, y: number) {
    const same = pick?.rackId === this.hovered?.rackId && pick?.partId === this.hovered?.partId;
    this.callbacks.onHover(pick, x, y);
    if (same) return;
    this.hovered = pick;
    this.renderer.domElement.style.cursor = pick ? "pointer" : "";
    if (this.state) {
      this.buildHighlight();
      this.invalidate();
    }
  }

  private onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || event.buttons) return;
    this.setHovered(this.pick(event), event.clientX, event.clientY);
  };

  private onPointerLeave = () => this.setHovered(null, 0, 0);

  private onPointerDown = (event: PointerEvent) => {
    this.down = { x: event.clientX, y: event.clientY };
  };

  private onPointerUp = (event: PointerEvent) => {
    const down = this.down;
    this.down = null;
    if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > CLICK_PX) return;
    this.callbacks.onSelect(this.pick(event));
  };

  // --- Loop ------------------------------------------------------------------

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h);
    const pad = getComputedStyle(this.container);
    const top = parseFloat(pad.scrollPaddingTop) || 0;
    const bottom = parseFloat(pad.scrollPaddingBottom) || 0;
    this.clearHeight = Math.max(h * 0.4, h - top - bottom);
    this.camera.aspect = w / h;
    this.camera.setViewOffset(w, h, 0, (bottom - top) / 2, w, h);
    if (this.state && !this.userMoved && !this.tween) {
      const sel = this.state.selected;
      if (sel) this.frameRack(sel.rackId);
      else this.frame(this.currentDirection(), true);
    }
    this.invalidate();
  }

  private invalidate() {
    if (!this.raf && this.visible) this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    this.raf = 0;
    let busy = false;

    if (this.tween) {
      const t = Math.min(1, (now - this.tween.start) / TWEEN_MS);
      const k = ease(t);
      this.controls.target.lerpVectors(this.tween.fromTarget, this.tween.toTarget, k);
      this.camera.position.lerpVectors(this.tween.fromPos, this.tween.toPos, k);
      if (t >= 1) this.tween = null;
      busy = true;
    }
    for (const r of this.racks) {
      if (r.rise === null) continue;
      const t = (now - r.rise) / RISE_MS;
      if (t < 0) {
        busy = true;
        continue;
      }
      r.group.scale.y = Math.max(0.0001, ease(Math.min(1, t)));
      if (t >= 1) r.rise = null;
      else busy = true;
    }
    if (this.controls.update()) busy = true;

    this.renderer.render(this.scene, this.camera);
    if (busy) this.invalidate();
  };
}

function grow(box: number[], by: number): number[] {
  const [x0, y0, z0, x1, y1, z1] = box;
  return [x0 - by, y0 - by, z0 - by, x1 + by, y1 + by, z1 + by];
}
