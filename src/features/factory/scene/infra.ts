import * as THREE from "three";
import type { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { Kit, buildPad, buildPart, type LineMats } from "../../home/assembly/builders";
import type { Shape } from "../../home/assembly/podSpec";
import type { FlowPos } from "../model/catalog";
import { BAY_DEPTH, SHELF, type FactoryLayout } from "../model/layout";

/*
 * The hall around the line, in the assembly line's hidden-line style: floor
 * markings for bays, buffer lanes, pads and the aisle; building columns and
 * the crane runway; the parts store's shelving with a stock block per
 * material; the overhead crane; and kit carts. Solids reuse `buildPart`, so
 * sizes here are given in metres and converted to its millimetres.
 */

type Box = Partial<Shape> & { w: number; h: number; d: number };

/** Solids from boxes (metres, min corner at x, y and front z), as one part anchored at the origin. */
function solid(kit: Kit, mats: LineMats, boxes: Box[]): THREE.Group {
  const shapes: Shape[] = boxes.map((b) => ({
    ...b,
    kind: b.kind ?? "box",
    x: (b.x ?? 0) * 1000,
    y: (b.y ?? 0) * 1000,
    z: (b.z ?? 0) * 1000,
    w: b.w * 1000,
    h: b.h * 1000,
    d: b.d * 1000,
  }));
  return buildPart(kit, { id: "infra", shapes }, mats);
}

/** One box centred on the origin in plan, standing on y = 0. */
export function block(kit: Kit, mats: LineMats, w: number, h: number, d: number, opts: Partial<Shape> = {}): THREE.Group {
  const g = solid(kit, mats, [{ w, h, d, ...opts }]);
  g.position.set(-w / 2, 0, d / 2);
  const wrap = new THREE.Group();
  wrap.add(g);
  return wrap;
}

function setFill(group: THREE.Object3D, fill: THREE.Material) {
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) o.material = fill;
  });
}

function rect(out: number[], x0: number, z0: number, x1: number, z1: number, y = 0.006) {
  out.push(x0, y, z0, x1, y, z0, x1, y, z0, x1, y, z1, x1, y, z1, x0, y, z1, x0, y, z1, x0, y, z0);
}

/** Corner brackets only, for a station bay. */
function brackets(out: number[], x0: number, z0: number, x1: number, z1: number, arm: number, y = 0.008) {
  for (const [x, z, sx, sz] of [
    [x0, z0, 1, 1],
    [x1, z0, -1, 1],
    [x1, z1, -1, -1],
    [x0, z1, 1, -1],
  ]) {
    out.push(x, y, z, x + sx * arm, y, z, x, y, z, x, y, z + sz * arm);
  }
}

export interface FloorMats {
  infra: LineMats;
  marking: LineMats;
  grid: LineMaterial;
  stockFill: THREE.Material;
  /** One per station, recoloured by its state. */
  stations: LineMaterial[];
}

export interface Floor {
  group: THREE.Group;
  /** Per material: the stock block, scaled in y by how full its shelf is. */
  stock: THREE.Object3D[];
  /** Invisible bay volumes for picking, `userData.station` set. */
  hits: THREE.Mesh[];
}

export function buildFloor(kit: Kit, mats: FloorMats, layout: FactoryLayout, flow: readonly FlowPos[]): Floor {
  const group = new THREE.Group();
  const { hall } = layout;

  const plane = kit.track(new THREE.PlaneGeometry(1, 1));
  plane.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(plane, kit.fill);
  ground.scale.set((hall.x1 - hall.x0) * 6, 1, (hall.z1 - hall.z0) * 6);
  ground.position.set((hall.x0 + hall.x1) / 2, -0.004, (hall.z0 + hall.z1) / 2);
  group.add(ground);

  const grid: number[] = [];
  for (let x = Math.ceil(hall.x0 / 4) * 4; x <= hall.x1; x += 4) grid.push(x, 0.001, hall.z0, x, 0.001, hall.z1);
  for (let z = Math.ceil(hall.z0 / 4) * 4; z <= hall.z1; z += 4) grid.push(hall.x0, 0.001, z, hall.x1, 0.001, z);
  const gridLines = kit.lines(grid, mats.grid);
  if (gridLines) group.add(gridLines);

  const outline: number[] = [];
  rect(outline, hall.x0, hall.z0, hall.x1, hall.z1);
  const lanes: number[] = [];
  flow.forEach((f, k) => {
    if (f.kind !== "buffer") return;
    const s = layout.spots[k];
    rect(lanes, s.x - s.len / 2 + 0.3, s.z - 1.9, s.x + s.len / 2 - 0.3, s.z + 1.9);
  });
  for (const s of [layout.receiving, ...layout.yard]) {
    group.add(buildPad(kit, mats.marking, s.x, s.z, s.len - 0.6, 3.8));
  }
  // Centre aisle: a dashed line from the store to the end of the rows.
  for (let x = layout.storeExit.x; x < hall.x1 - 3; x += 2) lanes.push(x, 0.006, 0, Math.min(x + 1.1, hall.x1 - 3), 0.006, 0);
  const outlineLines = kit.lines(outline, mats.marking.struct);
  const laneLines = kit.lines(lanes, mats.marking.detail);
  if (outlineLines) group.add(outlineLines);
  if (laneLines) group.add(laneLines);

  // Station bays: corner brackets in the station's state colour, plus its kit pad.
  const hitGeo = kit.track(new THREE.BoxGeometry(1, 1, 1));
  const hits: THREE.Mesh[] = [];
  flow.forEach((f, k) => {
    if (f.kind !== "station") return;
    const s = layout.spots[k];
    const x0 = s.x - s.len / 2 + 0.25;
    const x1 = s.x + s.len / 2 - 0.25;
    const z0 = s.z - BAY_DEPTH / 2 + 0.25;
    const z1 = s.z + BAY_DEPTH / 2 - 0.25;
    const segs: number[] = [];
    brackets(segs, x0, z0, x1, z1, 1.4);
    const lines = kit.lines(segs, mats.stations[f.station]);
    if (lines) group.add(lines);
    const pad = layout.pads[f.station];
    group.add(buildPad(kit, mats.marking, pad.x, pad.z, 2.2, 1.5));
    const hit = new THREE.Mesh(hitGeo, kit.fill);
    hit.scale.set(x1 - x0, 7, z1 - z0);
    hit.position.set(s.x, 3.5, s.z);
    hit.visible = false;
    hit.userData.station = f.station;
    hits.push(hit);
    group.add(hit);
  });

  // Building columns on both long walls, carrying the crane runway. Thin and
  // unfilled, so the near wall never hides the pods behind it.
  const [rz0, rz1] = layout.craneZ;
  const runwayY = layout.craneHeight;
  const frame: number[] = [];
  for (const x of layout.columns) {
    for (const z of [hall.z0 + 0.3, hall.z1 - 0.3]) frame.push(x, 0, z, x, runwayY + 0.6, z);
  }
  for (const z of [rz0, rz1]) {
    for (const y of [runwayY, runwayY + 0.55]) frame.push(hall.x0, y, z, hall.x1, y, z);
  }
  const frameLines = kit.lines(frame, mats.infra.detail);
  if (frameLines) group.add(frameLines);

  // The parts store: open shelving, one bay per material, its stock as a filled block.
  const stock: THREE.Object3D[] = [];
  for (const shelf of layout.shelves) {
    const frame = block(kit, mats.infra, SHELF.w, SHELF.h, SHELF.d, { ghost: true });
    frame.position.set(shelf.x, 0, shelf.z);
    group.add(frame);
    const levels: number[] = [];
    for (const y of [0.1, SHELF.h / 2]) {
      rect(levels, shelf.x - SHELF.w / 2, shelf.z - SHELF.d / 2, shelf.x + SHELF.w / 2, shelf.z + SHELF.d / 2, y);
    }
    const levelLines = kit.lines(levels, mats.infra.detail);
    if (levelLines) group.add(levelLines);
    const fill = block(kit, mats.marking, SHELF.w - 0.3, SHELF.h - 0.35, SHELF.d - 0.3);
    setFill(fill, mats.stockFill);
    fill.position.set(shelf.x, 0.12, shelf.z);
    group.add(fill);
    stock.push(fill);
  }

  return { group, stock, hits };
}

export interface Crane {
  group: THREE.Group;
  /** Moves the bridge to `x`, the trolley to `z` and the hook down to height `y`. */
  setHook: (x: number, z: number, y: number) => void;
}

export function buildCrane(kit: Kit, mats: LineMats, cable: LineMaterial, layout: FactoryLayout): Crane {
  const group = new THREE.Group();
  const [z0, z1] = layout.craneZ;
  const y = layout.craneHeight + 0.55;
  const bridge = new THREE.Group();
  const beam = block(kit, mats, 0.8, 0.9, z1 - z0 + 0.8);
  beam.position.set(0, y, (z0 + z1) / 2);
  bridge.add(beam);
  for (const z of [z0, z1]) {
    const truck = block(kit, mats, 2.4, 0.5, 0.6);
    truck.position.set(0, y, z);
    bridge.add(truck);
  }
  const trolley = block(kit, mats, 1.5, 0.6, 1.6);
  trolley.position.y = y + 0.9;
  bridge.add(trolley);
  const line = kit.lines([0, 0, 0, 0, -1, 0], cable)!;
  bridge.add(line);
  const hook = block(kit, mats, 0.7, 0.5, 0.7, { round: 120, roundAxis: "y" });
  bridge.add(hook);
  group.add(bridge);

  return {
    group,
    setHook: (x, z, hy) => {
      bridge.position.x = x;
      trolley.position.z = z;
      const top = y + 0.9;
      line.position.set(0, top, z);
      line.scale.y = Math.max(0.01, top - hy - 0.5);
      hook.position.set(0, hy, z);
    },
  };
}

/** A kit cart: a low deck carrying the kit as one filled block. */
export function buildCart(kit: Kit, mats: LineMats, fill: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.add(block(kit, mats, 1.7, 0.32, 1.1, { round: 60, roundAxis: "y" }));
  const load = block(kit, mats, 1.35, 0.75, 0.9);
  setFill(load, fill);
  load.position.y = 0.32;
  group.add(load);
  return group;
}
