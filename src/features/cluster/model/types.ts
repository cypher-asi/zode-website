/*
 * The cluster as data: what the builder edits, and the racks, parts and
 * fabric that `buildCluster` derives from it. Lengths are in metres.
 */

export type PlatformId = "b300" | "b200";
export type FabricId = "infiniband" | "roce" | "ethernet";

export interface ClusterConfig {
  platform: PlatformId;
  /** GPU nodes, one of `NODE_SIZES`. */
  nodes: number;
  /** GPU nodes per compute rack. */
  density: number;
  fabric: FabricId;
  /** Host links per uplink on every leaf: 1 is non-blocking. */
  oversubscription: number;
  /** Cabinet height in rack units. */
  rackU: number;
  /** Racks in one row before the next row starts. */
  rowLength: number;
  /** Shared NVMe storage per GPU node, TB. */
  storagePerNode: number;
}

export type PartKind =
  | "gpu"
  | "leaf"
  | "spine"
  | "storageSwitch"
  | "oob"
  | "edge"
  | "firewall"
  | "ufm"
  | "nas"
  | "mgmt"
  | "manifold"
  | "panel";

/** How parts are grouped for colour, visibility and the parts list. */
export type Layer = "compute" | "network" | "storage" | "management" | "rack";

export interface RackPart {
  id: string;
  kind: PartKind;
  label: string;
  model: string;
  /** Lowest rack unit the part occupies, counted from 1 at the bottom. */
  uStart: number;
  uSize: number;
  kw: number;
  specs: readonly (readonly [string, string])[];
}

export type RackKind = "compute" | "network";

export interface Rack {
  id: string;
  name: string;
  kind: RackKind;
  uHeight: number;
  row: number;
  /** Position along the row, from 0. */
  slot: number;
  /** Centre of the cabinet's footprint. */
  x: number;
  z: number;
  /** The side the cabinet front faces: +1 toward +z, -1 toward -z. */
  facing: 1 | -1;
  parts: RackPart[];
  kw: number;
  usedU: number;
  /** Switched PDUs on each of its feeds (see `pdusPerFeed`). */
  pdusPerFeed: number;
  /** A and B under 2N, or the one. */
  feeds: 1 | 2;
}

/** One GPU rail from a node to its leaf. */
export interface HostLink {
  rail: number;
  rackId: string;
  partId: string;
  leafRackId: string;
  leafId: string;
}

/** Every link between one leaf and one spine, drawn as one cable run. */
export interface Uplink {
  leafRackId: string;
  leafId: string;
  spineRackId: string;
  spineId: string;
  count: number;
}

export interface PartsRow {
  layer: Layer;
  label: string;
  model: string;
  qty: number;
  detail?: string;
}

export interface ClusterStats {
  nodes: number;
  gpus: number;
  racks: number;
  computeRacks: number;
  networkRacks: number;
  rows: number;
  itKw: number;
  gpuMemoryTb: number;
  /** Dense FP4, exaFLOPS. */
  fp4Exaflops: number;
  /** Every GPU's rail bandwidth added up, Tb/s. */
  fabricTbps: number;
  railGbps: number;
  storageTb: number;
  leaves: number;
  spines: number;
  switches: number;
  hostLinks: number;
  uplinks: number;
  optics: number;
  fiberKm: number;
  footprintM2: number;
}

export interface ClusterModel {
  config: ClusterConfig;
  racks: Rack[];
  hostLinks: HostLink[];
  uplinks: Uplink[];
  stats: ClusterStats;
  parts: PartsRow[];
  /** Height of the overhead cable tray above the floor. */
  trayY: number;
}
