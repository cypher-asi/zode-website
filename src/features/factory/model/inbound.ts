import type { Spread } from "./catalog";

/*
 * Inbound and receiving: who ships each material, how it arrives (the
 * handling unit, the truck, how many fill one), and the dock that takes it
 * in, from the gate to the shelf. Per-unit task times are minutes; the rest
 * is hours, as in the line's catalog. Like the line's figures, these are
 * planning placeholders until suppliers and carriers confirm them.
 */

/** Dock-high doors take enclosed trailers; the drive-in bay takes flatbeds under its own crane. */
export type TruckKind = "van" | "flatbed";

export interface Supplier {
  id: string;
  label: string;
  /** What it ships, as the panels say it. */
  ships: string;
  truck: TruckKind;
  /** Hours from a purchase order to the earliest appointment its first truck can make. */
  leadHours: number;
  /** Trucks a day it ships against one order; a bigger order goes out as daily drops. */
  perDay: number;
  /** When the truck turns up against its appointment, in hours; early is negative. */
  arrival: Spread;
}

export const SUPPLIERS: readonly Supplier[] = [
  {
    id: "steel",
    label: "Steel fabricator",
    ships: "Base frames, posts, rails and service roofs",
    truck: "flatbed",
    leadHours: 336,
    perDay: 2,
    arrival: [-2, -0.5, 4],
  },
  {
    id: "racks",
    label: "Rack integrator",
    ships: "Compute and network racks, crated, on air-ride vans",
    truck: "van",
    leadHours: 504,
    perDay: 3,
    arrival: [-1, 0, 2],
  },
  {
    id: "power",
    label: "Busway maker",
    ships: "Busway runs, crated in pairs",
    truck: "van",
    leadHours: 336,
    perDay: 1,
    arrival: [-1.5, -0.25, 3],
  },
  {
    id: "cooling",
    label: "Pipe fabricator",
    ships: "Cooling header spools, a pod's set to a crate",
    truck: "flatbed",
    leadHours: 336,
    perDay: 1,
    arrival: [-2, -0.5, 4],
  },
  {
    id: "fiber",
    label: "Cable tray supplier",
    ships: "Fiber trays on pallets",
    truck: "van",
    leadHours: 168,
    perDay: 1,
    arrival: [-1.5, -0.25, 3],
  },
  {
    id: "panels",
    label: "Panel maker",
    ships: "Wall and end panels, a pod's set to a pallet",
    truck: "van",
    leadHours: 252,
    perDay: 1,
    arrival: [-1.5, -0.25, 3],
  },
];

export type Equipment = "forklift" | "crane";

/** Where a material is put away. */
export type StoreZone = "cage" | "racking" | "steel";

export const ZONE_LABELS: Record<StoreZone, string> = {
  cage: "Secure cage",
  racking: "Racking",
  steel: "Steel lane",
};

export interface Handling {
  /** A MATERIALS id. */
  material: string;
  /** A SUPPLIERS id. */
  supplier: string;
  /** Units of the material in one handling unit (HU): a crate, a bundle or a pallet. */
  perHu: number;
  hu: string;
  /** HUs of this material alone that fill a truck; a mixed load adds up each HU's share. */
  perTruck: number;
  /** Minutes per HU: off the truck to its staging spot, the clerk's dock check, and posting the receipt. */
  unload: Spread;
  check: Spread;
  receipt: Spread;
  /** Incoming inspection: the share of HUs pulled, minutes per HU, the chance one fails, and what's checked. */
  inspect: { share: number; minutes: Spread; reject: number; test: string };
  /** Chance an HU arrives damaged, caught at the dock check. */
  damage: number;
  /** Minutes per HU from staging to its zone, and what moves it. */
  putaway: Spread;
  putawayWith: Equipment;
  zone: StoreZone;
}

export const HANDLING: readonly Handling[] = [
  {
    material: "base",
    supplier: "steel",
    perHu: 1,
    hu: "frame",
    perTruck: 4,
    unload: [15, 20, 35],
    check: [5, 8, 12],
    receipt: [4, 5, 8],
    inspect: {
      share: 1,
      minutes: [45, 60, 90],
      reject: 0.03,
      test: "Diagonals within 3 mm, flatness within 2 mm over 6 m, welds visual, coating thickness",
    },
    damage: 0.01,
    putaway: [10, 15, 25],
    putawayWith: "crane",
    zone: "steel",
  },
  {
    material: "post",
    supplier: "steel",
    perHu: 12,
    hu: "bundle of 12",
    perTruck: 16,
    unload: [6, 8, 12],
    check: [3, 4, 6],
    receipt: [3, 4, 6],
    inspect: {
      share: 0.25,
      minutes: [10, 15, 20],
      reject: 0.02,
      test: "Length, straightness and hole pattern on a sample",
    },
    damage: 0.005,
    putaway: [6, 8, 12],
    putawayWith: "forklift",
    zone: "steel",
  },
  {
    material: "rail",
    supplier: "steel",
    perHu: 8,
    hu: "bundle of 8",
    perTruck: 16,
    unload: [6, 8, 12],
    check: [3, 4, 6],
    receipt: [3, 4, 6],
    inspect: {
      share: 0.25,
      minutes: [10, 15, 20],
      reject: 0.02,
      test: "Length, straightness and hole pattern on a sample",
    },
    damage: 0.005,
    putaway: [6, 8, 12],
    putawayWith: "forklift",
    zone: "steel",
  },
  {
    material: "rack-compute",
    supplier: "racks",
    perHu: 1,
    hu: "crated rack",
    perTruck: 12,
    unload: [8, 12, 18],
    check: [5, 6, 10],
    receipt: [10, 15, 25],
    inspect: {
      share: 1,
      minutes: [15, 20, 30],
      reject: 0.01,
      test: "Crate, shock and tilt indicators, serial manifest against the ASN, factory test report",
    },
    damage: 0.01,
    putaway: [8, 10, 15],
    putawayWith: "forklift",
    zone: "cage",
  },
  {
    material: "rack-network",
    supplier: "racks",
    perHu: 1,
    hu: "crated rack",
    perTruck: 12,
    unload: [8, 12, 18],
    check: [5, 6, 10],
    receipt: [10, 15, 25],
    inspect: {
      share: 1,
      minutes: [15, 20, 30],
      reject: 0.01,
      test: "Crate, shock and tilt indicators, serial manifest against the ASN, factory test report",
    },
    damage: 0.01,
    putaway: [8, 10, 15],
    putawayWith: "forklift",
    zone: "cage",
  },
  {
    material: "busway",
    supplier: "power",
    perHu: 2,
    hu: "crate of 2 runs",
    perTruck: 10,
    unload: [6, 9, 14],
    check: [3, 4, 6],
    receipt: [3, 4, 6],
    inspect: {
      share: 1,
      minutes: [30, 40, 55],
      reject: 0.02,
      test: "Insulation resistance at 1,000 V, at least 100 MΩ, each run",
    },
    damage: 0.01,
    putaway: [6, 8, 12],
    putawayWith: "forklift",
    zone: "racking",
  },
  {
    material: "header",
    supplier: "cooling",
    perHu: 4,
    hu: "crate of 4 spools",
    perTruck: 6,
    unload: [10, 14, 20],
    check: [4, 6, 8],
    receipt: [3, 4, 6],
    inspect: {
      share: 0.25,
      minutes: [30, 45, 60],
      reject: 0.03,
      test: "Pressure decay at 1.5× working pressure for 30 minutes",
    },
    damage: 0.01,
    putaway: [8, 10, 15],
    putawayWith: "forklift",
    zone: "racking",
  },
  {
    material: "tray",
    supplier: "fiber",
    perHu: 10,
    hu: "pallet of 10",
    perTruck: 26,
    unload: [3, 4, 6],
    check: [2, 3, 4],
    receipt: [2, 3, 5],
    inspect: {
      share: 0.1,
      minutes: [8, 10, 15],
      reject: 0.01,
      test: "Dimensions and finish on a sample",
    },
    damage: 0.005,
    putaway: [4, 6, 8],
    putawayWith: "forklift",
    zone: "racking",
  },
  {
    material: "panel",
    supplier: "panels",
    perHu: 6,
    hu: "pallet of 6",
    perTruck: 14,
    unload: [5, 7, 10],
    check: [3, 5, 8],
    receipt: [3, 4, 6],
    inspect: {
      share: 0.2,
      minutes: [10, 15, 20],
      reject: 0.02,
      test: "Flatness, finish, gaskets and fixings on a sample",
    },
    damage: 0.03,
    putaway: [5, 7, 10],
    putawayWith: "forklift",
    zone: "racking",
  },
  {
    material: "roof",
    supplier: "steel",
    perHu: 1,
    hu: "roof",
    perTruck: 4,
    unload: [15, 20, 30],
    check: [4, 6, 10],
    receipt: [3, 5, 8],
    inspect: {
      share: 1,
      minutes: [20, 30, 40],
      reject: 0.02,
      test: "Flatness, seams, coating and lifting points",
    },
    damage: 0.02,
    putaway: [10, 15, 25],
    putawayWith: "crane",
    zone: "steel",
  },
];

export interface InboundConfig {
  /** Dock-high doors for vans, and drive-in flatbed bays, each bay with its own bridge crane. */
  vanDoors: number;
  flatbedBays: number;
  /** Trailer stalls in the truck yard; past that, trucks hold at the gate. */
  yardStalls: number;
  /** Marked floor positions behind the dock doors, and laydown positions in the flatbed bay. */
  dockStaging: number;
  bayLaydown: number;
  /** Receiving crew on the floor: forklift and crane operators, then clerks and QC inspectors. */
  handlers: number;
  forklifts: number;
  clerks: number;
  inspectors: number;
  /** The dock works from `opens` to `closes`, hours of the day; the gate is staffed around the clock. */
  opens: number;
  closes: number;
  /** Handlers a crane lift takes: the operator and a rigger. */
  craneCrew: number;
  /** Carriers' free hours at the dock before detention, and its rate in dollars an hour. */
  freeHours: number;
  detentionRate: number;
  /** A replacement for a damaged or rejected HU ships at this share of the usual lead time. */
  expedite: number;
  /** Above this share of staging in use, put-away goes before unloading. */
  highWater: number;
}

export const DEFAULT_INBOUND: InboundConfig = {
  vanDoors: 3,
  flatbedBays: 1,
  yardStalls: 8,
  dockStaging: 32,
  bayLaydown: 8,
  handlers: 3,
  forklifts: 2,
  clerks: 2,
  inspectors: 2,
  opens: 6,
  closes: 22,
  craneCrew: 2,
  freeHours: 2,
  detentionRate: 75,
  expedite: 0.5,
  highWater: 0.75,
};

/** Appointment slots: vans on the hour, flatbeds every three hours, each slot one truck per door. */
export const SLOT_HOURS: Record<TruckKind, number> = { van: 1, flatbed: 3 };

/** Minutes for each truck-level task. */
export const TRUCK_MINUTES = {
  /** The guard checks the appointment, driver, BOL and seal. */
  gate: [5, 8, 15] as Spread,
  /** Pulling up from the yard and backing on, restraint and leveler (vans), or driving into the bay. */
  dock: [10, 15, 25] as Spread,
  /** A flatbed's driver takes off the tarps and straps before the first lift. */
  untarp: [20, 30, 45] as Spread,
  /** The clerk signs the BOL, noting any exceptions. */
  bol: [4, 6, 10] as Spread,
  /** Leveler stowed, restraint released, off the door. */
  pullOut: [5, 8, 12] as Spread,
};

export const supplierIndex = (id: string): number => SUPPLIERS.findIndex((s) => s.id === id);
