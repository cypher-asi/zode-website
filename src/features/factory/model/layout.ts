import { POD } from "../../home/assembly/podSpec";
import { MATERIALS, type FlowPos } from "./catalog";

/*
 * The floor plan, in metres: x along the hall, z across it (toward the
 * viewer), y up. The line is a U: the first row runs +x along the back, the
 * second comes back -x along the front, so pods enter and leave at the same
 * end, beside receiving, the parts store and the outbound yard. Kits travel
 * down the centre aisle between the rows.
 */

export const POD_LEN = POD.length / 1000;
export const POD_WID = POD.width / 1000;

/** Along-the-line length of a station bay (pod plus a work zone at each end) and of a buffer slot. */
const BAY_LEN = 11;
const SLOT_LEN = 7.6;
export const BAY_DEPTH = 9;
/** Centre lines of the two rows. */
const ROW_Z = [-8, 8] as const;
const AISLE = ROW_Z[1] - ROW_Z[0] - BAY_DEPTH;
/** The pod-free end of the hall: receiving, store and yard sit in x < 0. */
const END_ZONE = 26;
export const YARD_SLOTS = 3;

export interface Spot {
  x: number;
  z: number;
  /** Along-the-line length it occupies. */
  len: number;
  row: 0 | 1;
}

export interface Shelf {
  material: number;
  x: number;
  z: number;
}

export interface FactoryLayout {
  /** Per flow position: where the pod there sits. */
  spots: Spot[];
  receiving: Spot;
  yard: Spot[];
  /** Per station: its kit pad on the aisle side of the bay. */
  pads: { x: number; z: number }[];
  /** Where kit carts leave the store into the aisle. */
  storeExit: { x: number; z: number };
  store: { x0: number; x1: number; z0: number; z1: number };
  shelves: Shelf[];
  hall: { x0: number; x1: number; z0: number; z1: number };
  /** Runway lines of the overhead crane, across the hall. */
  craneZ: [number, number];
  craneHeight: number;
  /** Building column positions along x, on both long walls. */
  columns: number[];
}

export const SHELF = { w: 2.6, h: 2.6, d: 1.3 };

export function layoutFor(flow: readonly FlowPos[], stations: number): FactoryLayout {
  const lens = flow.map((f) => (f.kind === "station" ? BAY_LEN : SLOT_LEN));
  const total = lens.reduce((a, b) => a + b, 0);
  // Split into rows as close to even as the positions allow.
  let split = 0;
  let run = 0;
  let best = Infinity;
  for (let k = 0; k <= flow.length; k++) {
    const diff = Math.abs(run - (total - run));
    if (diff < best) {
      best = diff;
      split = k;
    }
    run += lens[k] ?? 0;
  }
  const len0 = lens.slice(0, split).reduce((a, b) => a + b, 0);
  const len1 = total - len0;
  const right = Math.max(len0, len1);

  const spots: Spot[] = [];
  let x = 0;
  for (let k = 0; k < split; k++) {
    spots.push({ x: x + lens[k] / 2, z: ROW_Z[0], len: lens[k], row: 0 });
    x += lens[k];
  }
  x = right;
  for (let k = split; k < flow.length; k++) {
    spots.push({ x: x - lens[k] / 2, z: ROW_Z[1], len: lens[k], row: 1 });
    x -= lens[k];
  }

  const padZ = (row: 0 | 1) => (row === 0 ? ROW_Z[0] + BAY_DEPTH / 2 - 1.2 : ROW_Z[1] - BAY_DEPTH / 2 + 1.2);
  const pads = Array.from({ length: stations }, (_, i) => {
    const spot = spots[flow.findIndex((f) => f.kind === "station" && f.station === i)];
    return { x: spot.x + (spot.row === 0 ? 2.6 : -2.6), z: padZ(spot.row) };
  });

  const store = { x0: -19.5, x1: -4, z0: -AISLE / 2 + 0.4, z1: AISLE / 2 - 0.4 };
  const perRow = Math.ceil(MATERIALS.length / 2);
  const shelves = MATERIALS.map((_, m) => {
    const col = m % perRow;
    const row = Math.floor(m / perRow);
    return {
      material: m,
      x: store.x0 + 0.6 + SHELF.w / 2 + col * (SHELF.w + 0.3),
      z: row === 0 ? -SHELF.d / 2 - 0.5 : SHELF.d / 2 + 0.5,
    };
  });

  const yard = Array.from({ length: YARD_SLOTS }, (_, i) => ({
    x: -3 - SLOT_LEN / 2 - i * SLOT_LEN,
    z: ROW_Z[1],
    len: SLOT_LEN,
    row: 1 as const,
  }));
  const hall = { x0: -END_ZONE, x1: right + 3, z0: ROW_Z[0] - BAY_DEPTH / 2 - 1.5, z1: ROW_Z[1] + BAY_DEPTH / 2 + 1.5 };
  const columns: number[] = [];
  const bays = Math.max(1, Math.round((hall.x1 - hall.x0) / 12));
  for (let i = 0; i <= bays; i++) columns.push(hall.x0 + ((hall.x1 - hall.x0) * i) / bays);

  return {
    spots,
    receiving: { x: -3 - SLOT_LEN / 2, z: ROW_Z[0], len: SLOT_LEN, row: 0 },
    yard,
    pads,
    storeExit: { x: store.x1 + 0.6, z: 0 },
    store,
    shelves,
    hall,
    craneZ: [hall.z0 + 0.6, hall.z1 - 0.6],
    craneHeight: 10.5,
    columns,
  };
}

/** Where a spot or the yard sits for a flow position index (receiving at -1, the yard past the end). */
export function spotOf(layout: FactoryLayout, pos: number, yardSlot = 0): Spot {
  if (pos < 0) return layout.receiving;
  if (pos >= layout.spots.length) return layout.yard[yardSlot % layout.yard.length];
  return layout.spots[pos];
}
