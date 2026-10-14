import * as THREE from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import type { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { Kit, type LineMats } from "../../home/assembly/builders";
import { COMPUTE_POD, stepOf } from "../model/catalog";
import { BAY_DEPTH, YARD_SLOTS, layoutFor, spotOf, type FactoryLayout, type Spot } from "../model/layout";
import { lastAtOrBefore, podPlace, podsStarted, stationStateAt, stockAt, WORKING, type Trace } from "../sim/trace";
import { buildCart, buildCrane, buildFloor, type Crane, type Floor } from "./infra";
import { readPalette, type Palette } from "./palette";
import { PodInstance, buildPodTemplates, type PodTemplates } from "./podModel";

/*
 * The factory floor's 3D view, kept out of React: an isometric orthographic
 * camera with pan and zoom, the hall and line rebuilt when the trace's
 * layout changes, and everything that moves set from the trace at the
 * playhead. Frames are drawn only when something changed, and only while
 * the view is on screen.
 */

export type Selection = { kind: "station"; station: number } | { kind: "pod"; pod: number } | null;

export interface ViewCallbacks {
  onSelect: (selection: Selection) => void;
  /** Screen positions (CSS pixels, x then y) of the anchors given to `setAnchors`, after each frame. */
  onProject: (xy: Float32Array) => void;
}

/** Plan directions from the scene to the camera, one per isometric corner. */
const CORNERS: [number, number][] = [
  [1, 1],
  [-1, 1],
  [-1, -1],
  [1, -1],
];
const CLICK_PX = 5;
const STRUCT = 1.15;
const DETAIL = 0.55;

interface Mats {
  pod: LineMats;
  active: LineMats;
  infra: LineMats;
  marking: LineMats;
  grid: LineMaterial;
  cable: LineMaterial;
  select: LineMaterial;
  fill: THREE.MeshBasicMaterial;
  stockFill: THREE.MeshBasicMaterial;
}

interface FloorBuild {
  kit: Kit;
  layout: FactoryLayout;
  floor: Floor;
  crane: Crane;
  stations: LineMaterial[];
  pool: PodInstance[];
  carts: THREE.Group[];
}

/** Lookups the per-frame pass needs, made once per trace. */
interface Index {
  /** Per podSpec step, the station that builds it, or -1. */
  stepStation: number[];
  stationSpot: Spot[];
  kitStarts: number[];
  liftStarts: number[];
}

export class FactoryView {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2000);
  private readonly controls: MapControls;
  private readonly raycaster = new THREE.Raycaster();
  private readonly observer: ResizeObserver;
  private readonly intersection: IntersectionObserver;
  private readonly kit: Kit;
  private readonly mats: Mats;
  private readonly lineMats: LineMaterial[] = [];
  private readonly templates: PodTemplates;
  private palette: Palette;

  private trace: Trace | null = null;
  private index: Index | null = null;
  private build: FloorBuild | null = null;
  private t = 0;
  private selection: Selection = null;
  private cutaway = false;
  private corner = 0;
  /** World height the view spans at zoom 1. */
  private viewHeight = 60;
  private width = 1;
  private height = 1;
  private anchors: THREE.Vector3[] = [];
  private projected = new Float32Array(0);
  private readonly ring: LineSegments2;
  private readonly podPositions = new Map<number, THREE.Vector3>();
  private raf = 0;
  private down: { x: number; y: number } | null = null;
  private hover: PointerEvent | null = null;
  private hoverRaf = 0;
  private onScreen = true;
  /** Something changed while the view couldn't be seen; draw it when it can. */
  private stale = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly callbacks: ViewCallbacks,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.5 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.setAttribute("aria-hidden", "true");
    container.appendChild(this.renderer.domElement);

    this.palette = readPalette(container);
    const fill = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    this.kit = new Kit(fill);
    const pair = (structWidth: number, detailWidth: number): LineMats => ({
      struct: this.line(structWidth),
      detail: this.line(detailWidth),
    });
    this.mats = {
      pod: pair(STRUCT, DETAIL),
      active: pair(STRUCT * 1.2, DETAIL * 1.2),
      infra: pair(1, 0.5),
      marking: pair(1, 0.6),
      grid: this.line(1),
      cable: this.line(0.8),
      select: this.line(2.4),
      fill,
      stockFill: fill.clone(),
    };
    this.kit.materials.push(this.mats.stockFill);
    this.mats.select.depthTest = false;
    this.templates = buildPodTemplates(this.kit, this.mats.pod, this.mats.infra);

    const h = 0.5;
    this.ring = this.kit.lines(
      [-h, 0, -h, h, 0, -h, h, 0, -h, h, 0, h, h, 0, h, -h, 0, h, -h, 0, h, -h, 0, -h],
      this.mats.select,
    )!;
    this.ring.renderOrder = 10;
    this.ring.visible = false;
    this.scene.add(this.ring);

    this.paint();

    this.controls = new MapControls(this.camera, this.renderer.domElement);
    this.controls.enableRotate = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.zoomToCursor = true;
    this.controls.minZoom = 0.6;
    this.controls.maxZoom = 14;
    this.controls.addEventListener("change", () => this.invalidate());

    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointermove", this.onPointerMove);

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.intersection = new IntersectionObserver((entries) => {
      this.onScreen = entries[entries.length - 1].isIntersecting;
      this.catchUp();
    });
    this.intersection.observe(container);
    document.addEventListener("visibilitychange", this.catchUp);
    this.resize();
  }

  // --- Public ------------------------------------------------------------------

  setTrace(trace: Trace): void {
    const prev = this.trace;
    this.trace = trace;
    const sameFloor =
      prev &&
      this.build &&
      prev.flow.length === trace.flow.length &&
      prev.flow.every((f, i) => f.kind === trace.flow[i].kind);
    if (!sameFloor) this.rebuild(trace);
    const layout = this.build!.layout;
    this.index = {
      stepStation: COMPUTE_POD.steps.map((step) => trace.scenario.stations.findIndex((s) => stepOf(s)?.id === step.id)),
      stationSpot: trace.scenario.stations.map((_, i) =>
        spotOf(layout, trace.flow.findIndex((f) => f.kind === "station" && f.station === i)),
      ),
      kitStarts: trace.kits.map((k) => k.t0),
      liftStarts: trace.crane.map((l) => l.t0),
    };
    if (!prev) this.fit();
    this.invalidate();
  }

  setTime(t: number): void {
    if (t === this.t) return;
    this.t = t;
    this.invalidate();
  }

  setSelection(selection: Selection): void {
    this.selection = selection;
    this.invalidate();
  }

  setCutaway(on: boolean): void {
    this.cutaway = on;
    this.invalidate();
  }

  setAnchors(points: readonly [number, number, number][]): void {
    this.anchors = points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    this.projected = new Float32Array(points.length * 2);
    this.invalidate();
  }

  /** Frames the whole hall from the current corner. */
  fit(): void {
    const layout = this.build?.layout;
    if (!layout) return;
    const { hall } = layout;
    const target = new THREE.Vector3((hall.x0 + hall.x1) / 2, 0, (hall.z0 + hall.z1) / 2);
    this.aim(target);
    this.camera.updateMatrixWorld();
    const inv = this.camera.matrixWorldInverse;
    const box = new THREE.Box3();
    for (const x of [hall.x0, hall.x1]) {
      for (const y of [0, layout.craneHeight + 1.5]) {
        for (const z of [hall.z0, hall.z1]) box.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(inv));
      }
    }
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    // Shift the target to the centre of what's on screen.
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    target.addScaledVector(right, centre.x).addScaledVector(up, centre.y);
    this.aim(target);
    this.viewHeight = Math.max(size.y, size.x / (this.width / this.height)) * 1.06;
    this.camera.zoom = 1;
    this.updateFrustum();
    this.controls.update();
    this.invalidate();
  }

  /** Turns the view to the next isometric corner, about the current target. */
  rotate(): void {
    this.corner = (this.corner + 1) % CORNERS.length;
    this.aim(this.controls.target.clone());
    this.controls.update();
    this.invalidate();
  }

  /** Re-reads the theme's colours. */
  paint(): void {
    const p = (this.palette = readPalette(this.container));
    this.scene.background = p.bg;
    this.mats.fill.color.copy(p.bg);
    this.mats.stockFill.color.copy(p.stock);
    this.mats.pod.struct.color.copy(p.line);
    this.mats.pod.detail.color.copy(p.detail);
    this.mats.active.struct.color.copy(p.accent);
    this.mats.active.detail.color.copy(p.accent);
    this.mats.infra.struct.color.copy(p.infra);
    this.mats.infra.detail.color.copy(p.infraDetail);
    this.mats.marking.struct.color.copy(p.marking);
    this.mats.marking.detail.color.copy(p.grid);
    this.mats.grid.color.copy(p.grid);
    this.mats.cable.color.copy(p.infra);
    this.mats.select.color.copy(p.accent);
    if (this.build) this.build.kit.fill.color.copy(p.bg);
    this.invalidate();
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    cancelAnimationFrame(this.hoverRaf);
    this.observer.disconnect();
    this.intersection.disconnect();
    document.removeEventListener("visibilitychange", this.catchUp);
    this.controls.dispose();
    this.disposeBuild();
    this.kit.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // --- Building ------------------------------------------------------------------

  private line(width: number): LineMaterial {
    const m = new LineMaterial({ linewidth: width, transparent: true });
    m.resolution.set(this.width, this.height);
    this.lineMats.push(m);
    this.kit.materials.push(m);
    return m;
  }

  private disposeBuild() {
    const b = this.build;
    if (!b) return;
    for (const pod of b.pool) pod.root.removeFromParent();
    for (const cart of b.carts) cart.removeFromParent();
    b.floor.group.removeFromParent();
    b.crane.group.removeFromParent();
    for (const m of b.stations) {
      this.lineMats.splice(this.lineMats.indexOf(m), 1);
      m.dispose();
    }
    b.kit.dispose();
    this.build = null;
  }

  private rebuild(trace: Trace) {
    this.disposeBuild();
    const layout = layoutFor(trace.flow, trace.scenario.stations.length);
    const fill = this.mats.fill.clone();
    const kit = new Kit(fill);
    const stations = trace.scenario.stations.map(() => {
      const m = new LineMaterial({ linewidth: 1.8, transparent: true });
      m.resolution.set(this.width, this.height);
      this.lineMats.push(m);
      return m;
    });
    const floor = buildFloor(
      kit,
      { infra: this.mats.infra, marking: this.mats.marking, grid: this.mats.grid, stockFill: this.mats.stockFill, stations },
      layout,
      trace.flow,
    );
    this.scene.add(floor.group);
    const crane = buildCrane(kit, this.mats.infra, this.mats.cable, layout);
    this.scene.add(crane.group);
    // Every position can hold a pod, and the yard shows the last few out.
    const pool = Array.from({ length: trace.flow.length + YARD_SLOTS + 1 }, () => {
      const pod = new PodInstance(this.templates, this.mats.pod);
      pod.root.visible = false;
      this.scene.add(pod.root);
      return pod;
    });
    const carts = trace.scenario.stations.map(() => {
      const cart = buildCart(kit, this.mats.infra, this.mats.stockFill);
      cart.visible = false;
      this.scene.add(cart);
      return cart;
    });
    this.build = { kit, layout, floor, crane, stations, pool, carts };
  }

  // --- Applying the trace at the playhead --------------------------------------------

  private hiddenParts(): Set<string> {
    const hidden = new Set<string>();
    if (!this.cutaway) return hidden;
    const [cx, cz] = CORNERS[this.corner];
    hidden.add("service-roof");
    for (const id of cz > 0 ? ["front-a", "front-b"] : ["rear-a", "rear-b"]) hidden.add(id);
    hidden.add(cx > 0 ? "end-r" : "end-l");
    return hidden;
  }

  private apply() {
    const trace = this.trace;
    const b = this.build;
    const index = this.index;
    if (!trace || !b || !index) return;
    const t = this.t;
    const { layout } = b;
    const yard = trace.flow.length;
    const stations = trace.scenario.stations;
    const { stepStation, stationSpot } = index;
    const hidden = this.hiddenParts();
    const progress = new Array(COMPUTE_POD.steps.length).fill(0);
    this.podPositions.clear();

    // Pods: newest first, until the yard has shown its last few.
    let used = 0;
    let inYard = 0;
    for (let i = podsStarted(trace, t) - 1; i >= 0 && used < b.pool.length; i--) {
      const pod = trace.pods[i];
      const place = podPlace(pod, t);
      if (!place) continue;
      if (place.to === yard && ++inYard > YARD_SLOTS) break;
      const a = spotOf(layout, place.from, i);
      const c = spotOf(layout, place.to, i);
      const k = place.u * place.u * (3 - 2 * place.u);
      const inst = b.pool[used++];
      inst.pod = i;
      inst.root.visible = true;
      inst.root.position.set(a.x + (c.x - a.x) * k, 0, a.z + (c.z - a.z) * k);
      this.podPositions.set(i, inst.root.position);
      stepStation.forEach((s, step) => {
        const start = pod.start[s];
        const end = pod.end[s];
        progress[step] = s < 0 || !(t >= start) ? 0 : t >= end ? 1 : (t - start) / (end - start);
      });
      inst.apply(progress, this.mats.pod, this.mats.active, hidden);
    }
    for (let i = used; i < b.pool.length; i++) {
      b.pool[i].root.visible = false;
      b.pool[i].pod = -1;
    }

    // Station bays in their state's colour.
    trace.stations.forEach((series, i) => {
      const state = stationStateAt(series, t);
      b.stations[i].color.copy(this.palette.states[state]);
      b.stations[i].linewidth = state === WORKING ? 2.2 : 1.6;
    });

    // Store levels.
    trace.stock.forEach((series, m) => {
      const full = trace.orderUpTo[m];
      b.floor.stock[m].scale.y = full ? Math.max(0.015, Math.min(1, stockAt(series, t) / full)) : 0.015;
    });

    // Kit carts: each station's latest trip, on the way down the aisle or waiting on its pad.
    const seen = new Set<number>();
    for (const cart of b.carts) cart.visible = false;
    for (let j = lastAtOrBefore(index.kitStarts, t); j >= 0 && seen.size < stations.length; j--) {
      const trip = trace.kits[j];
      if (seen.has(trip.station)) continue;
      seen.add(trip.station);
      if (t >= trip.used) continue;
      const cart = b.carts[trip.station];
      cart.visible = true;
      const pad = layout.pads[trip.station];
      const from = layout.storeExit;
      const u = Math.min(1, (t - trip.t0) / Math.max(1e-6, trip.t1 - trip.t0));
      const legA = Math.abs(pad.x - from.x);
      const legB = Math.abs(pad.z - from.z);
      const d = (u * u * (3 - 2 * u)) * (legA + legB);
      if (d <= legA) cart.position.set(from.x + Math.sign(pad.x - from.x) * d, 0, from.z);
      else cart.position.set(pad.x, 0, from.z + Math.sign(pad.z - from.z) * (d - legA));
      cart.rotation.y = d <= legA ? 0 : Math.PI / 2;
    }

    // Crane: travels to a lift, lowers, holds, then waits there with the hook up.
    const lifts = trace.crane;
    const j = lastAtOrBefore(index.liftStarts, t);
    const posOf = (station: number) => stationSpot[station];
    const rest = posOf(0);
    const up = layout.craneHeight - 1.6;
    if (j < 0) b.crane.setHook(rest.x, rest.z, up);
    else {
      const lift = lifts[j];
      const here = posOf(lift.station);
      const prev = j > 0 ? posOf(lifts[j - 1].station) : rest;
      const travel = Math.min(0.4, (lift.t1 - lift.t0) / 3);
      const low = 5.6;
      if (t < lift.t0 + travel) {
        const u = (t - lift.t0) / travel;
        const k = u * u * (3 - 2 * u);
        b.crane.setHook(prev.x + (here.x - prev.x) * k, prev.z + (here.z - prev.z) * k, up);
      } else if (t < lift.t1) {
        const u = Math.min(1, (t - lift.t0 - travel) / travel);
        b.crane.setHook(here.x, here.z, up + (low - up) * u);
      } else b.crane.setHook(here.x, here.z, up);
    }

    // Selection outline.
    const sel = this.selection;
    this.ring.visible = false;
    if (sel?.kind === "station") {
      const s = posOf(sel.station);
      this.ring.visible = true;
      this.ring.position.set(s.x, 0.02, s.z);
      this.ring.scale.set(s.len - 0.2, 1, BAY_DEPTH - 0.2);
    } else if (sel?.kind === "pod") {
      const p = this.podPositions.get(sel.pod);
      if (p) {
        this.ring.visible = true;
        this.ring.position.set(p.x, 0.02, p.z);
        this.ring.scale.set(7.6, 1, 3.8);
      }
    }
  }

  // --- Camera ----------------------------------------------------------------------

  private aim(target: THREE.Vector3) {
    const [cx, cz] = CORNERS[this.corner];
    // (±1, 1, ±1): true isometric, about 35.26 degrees down.
    const dir = new THREE.Vector3(cx, 1, cz).normalize();
    this.controls.target.copy(target);
    this.camera.position.copy(target).addScaledVector(dir, 600);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(target);
  }

  private updateFrustum() {
    const aspect = this.width / this.height;
    const h = this.viewHeight / 2;
    this.camera.left = -h * aspect;
    this.camera.right = h * aspect;
    this.camera.top = h;
    this.camera.bottom = -h;
    this.camera.updateProjectionMatrix();
  }

  // --- Picking ---------------------------------------------------------------------

  private pick(event: { clientX: number; clientY: number }): Selection {
    const b = this.build;
    if (!b) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const pods = b.pool.filter((p) => p.root.visible).map((p) => p.root);
    for (const hit of this.raycaster.intersectObjects(pods, true)) {
      if (!(hit.object instanceof THREE.Mesh) || !shown(hit.object)) continue;
      const inst = hit.object.userData.podInstance as PodInstance | undefined;
      if (inst && inst.pod >= 0) return { kind: "pod", pod: inst.pod };
    }
    const station = this.raycaster.intersectObjects(b.floor.hits, false)[0];
    return station ? { kind: "station", station: station.object.userData.station as number } : null;
  }

  private onPointerDown = (event: PointerEvent) => {
    this.down = { x: event.clientX, y: event.clientY };
  };

  private onPointerUp = (event: PointerEvent) => {
    const down = this.down;
    this.down = null;
    if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > CLICK_PX) return;
    this.callbacks.onSelect(this.pick(event));
  };

  private onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || event.buttons) return;
    this.hover = event;
    if (!this.hoverRaf) this.hoverRaf = requestAnimationFrame(this.hoverTick);
  };

  private hoverTick = () => {
    this.hoverRaf = 0;
    const event = this.hover;
    this.hover = null;
    if (event) this.renderer.domElement.style.cursor = this.pick(event) ? "pointer" : "";
  };

  // --- Loop ------------------------------------------------------------------------

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h);
    for (const m of this.lineMats) m.resolution.set(w, h);
    this.updateFrustum();
    this.invalidate();
  }

  private visible(): boolean {
    return this.onScreen && document.visibilityState !== "hidden";
  }

  private invalidate() {
    if (!this.visible()) this.stale = true;
    else if (!this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  private catchUp = () => {
    if (!this.stale || !this.visible()) return;
    this.stale = false;
    this.invalidate();
  };

  private tick = () => {
    this.raf = 0;
    if (!this.visible()) {
      this.stale = true;
      return;
    }
    const moving = this.controls.update();
    this.apply();
    this.renderer.render(this.scene, this.camera);
    this.project();
    if (moving) this.invalidate();
  };

  private project() {
    if (!this.anchors.length) return;
    const v = new THREE.Vector3();
    this.anchors.forEach((a, i) => {
      v.copy(a).project(this.camera);
      this.projected[i * 2] = ((v.x + 1) / 2) * this.width;
      this.projected[i * 2 + 1] = ((1 - v.y) / 2) * this.height;
    });
    this.callbacks.onProject(this.projected);
  }
}

function shown(o: THREE.Object3D): boolean {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) if (!n.visible) return false;
  return true;
}

/** Plan centre of each station's bay and the other zones, for labels. */
export function labelAnchors(trace: Trace): { layout: FactoryLayout; points: [number, number, number][] } {
  const layout = layoutFor(trace.flow, trace.scenario.stations.length);
  const points: [number, number, number][] = trace.scenario.stations.map((_, i) => {
    const s = layout.spots[trace.flow.findIndex((f) => f.kind === "station" && f.station === i)];
    const edge = s.row === 0 ? s.z - BAY_DEPTH / 2 : s.z + BAY_DEPTH / 2;
    return [s.x, 0, edge];
  });
  points.push([layout.receiving.x, 0, layout.receiving.z - 2.2]);
  points.push([(layout.store.x0 + layout.store.x1) / 2, 0, layout.store.z0 - 0.2]);
  points.push([layout.yard[1].x, 0, layout.yard[1].z + 2.2]);
  return { layout, points };
}

export const ZONE_LABELS = ["Receiving", "Parts store", "Outbound yard"] as const;
