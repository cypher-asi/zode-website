import type { ClusterConfig, FabricId, Layer, PartKind, PlatformId } from "./types";

/*
 * Hardware and sizing assumptions behind the cluster builder, after the
 * OD3N deployment planner's reference architecture. Every power figure, port
 * count and capacity here is a PLACEHOLDER for planning conversations, not a
 * specification; edit them in place.
 */

export const GPUS_PER_NODE = 8;
/** One NIC per GPU, so one fabric rail per GPU. */
export const RAILS = 8;

/** Cluster sizes offered, in GPU nodes; every one closes as a two-tier fabric. */
export const NODE_SIZES = [8, 16, 32, 64, 128, 256] as const;
export const DENSITIES = [4, 8] as const;
export const RACK_HEIGHTS = [42, 48] as const;
export const ROW_LENGTHS = [8, 12, 16] as const;
export const STORAGE_PER_NODE = [0, 2, 4, 8, 16, 32] as const;
export const OVERSUBSCRIPTION = [1, 2] as const;

export const DEFAULT_CLUSTER: ClusterConfig = {
  platform: "b300",
  nodes: 64,
  density: 8,
  fabric: "infiniband",
  oversubscription: 1,
  rackU: 42,
  rowLength: 12,
  storagePerNode: 4,
};

/** Cabinet geometry: 800 x 1200 mm footprint, 44.45 mm rack units. */
export const RACK = {
  width: 0.8,
  depth: 1.2,
  unit: 0.04445,
  /** Plinth under the first U plus the roof over the last. */
  frame: 0.2,
  /** Aisle between two cabinet backs. */
  hotAisle: 1.0,
  /** Aisle between two cabinet fronts. */
  coldAisle: 1.2,
} as const;

export const rackHeight = (u: number) => u * RACK.unit + RACK.frame;
/** Height of the bottom of rack unit `u` above the floor. */
export const unitY = (u: number) => RACK.frame / 2 + (u - 1) * RACK.unit;

/** What goes into one GPU node besides its GPUs, counted for the BOM's slots. */
export interface NodeBill {
  cpus: number;
  dimms: number;
  bootDrives: number;
  /** Local NVMe, apart from the shared storage. */
  dataDrives: number;
  /** North-south DPUs or NICs for the front-end and storage network. */
  frontEndNics: number;
  powerCords: number;
}

export interface Platform {
  label: string;
  short: string;
  gpu: string;
  gpuMemoryGb: number;
  /** Dense FP4 per GPU, PFLOPS. */
  fp4Pflops: number;
  /** Per-GPU NIC, and so per-rail, bandwidth. */
  railGbps: number;
  nodeKw: number;
  nodeU: number;
  nic: string;
  cpu: string;
  bill: NodeBill;
}

export const PLATFORMS: Record<PlatformId, Platform> = {
  b300: {
    label: "NVIDIA HGX B300",
    short: "B300",
    gpu: "Blackwell Ultra",
    gpuMemoryGb: 288,
    fp4Pflops: 13.5,
    railGbps: 800,
    nodeKw: 14.3,
    nodeU: 4,
    nic: "8 x ConnectX-8 800G",
    cpu: "2 x Intel Xeon 6",
    bill: { cpus: 2, dimms: 32, bootDrives: 2, dataDrives: 6, frontEndNics: 2, powerCords: 10 },
  },
  b200: {
    label: "NVIDIA HGX B200",
    short: "B200",
    gpu: "Blackwell",
    gpuMemoryGb: 180,
    fp4Pflops: 9,
    railGbps: 400,
    nodeKw: 11.5,
    nodeU: 4,
    nic: "8 x ConnectX-7 400G",
    cpu: "2 x Intel Xeon 6",
    bill: { cpus: 2, dimms: 32, bootDrives: 2, dataDrives: 8, frontEndNics: 2, powerCords: 6 },
  },
};

export interface SwitchModel {
  model: string;
  uSize: number;
  kw: number;
  /** Ports at 800G; a 400G rail breaks each one out into two. */
  ports: number;
  /** Power supplies, each needing its own cord. */
  psus: number;
}

export interface Fabric {
  label: string;
  detail: string;
  compute: SwitchModel;
  /** InfiniBand needs a subnet manager; Ethernet runs its own control plane. */
  fabricManager: boolean;
}

export const FABRICS: Record<FabricId, Fabric> = {
  infiniband: {
    label: "InfiniBand",
    detail: "NVIDIA Quantum-X800 XDR",
    compute: { model: "Quantum-X800 Q3400-RA", uSize: 4, kw: 3.2, ports: 144, psus: 8 },
    fabricManager: true,
  },
  roce: {
    label: "Spectrum-X",
    detail: "NVIDIA Spectrum-X Ethernet, RoCE v2",
    compute: { model: "Spectrum-X SN5600", uSize: 2, kw: 1.8, ports: 64, psus: 4 },
    fabricManager: false,
  },
  ethernet: {
    label: "Ethernet",
    detail: "Broadcom Tomahawk 5 Ethernet, RoCE v2",
    compute: { model: "Arista 7060X6-64PE", uSize: 2, kw: 1.6, ports: 64, psus: 2 },
    fabricManager: false,
  },
};

/** The storage / front-end network and everything else in the network racks, the same for either fabric. */
export const SUPPORT = {
  storageSwitch: { model: "Spectrum-4 SN5600", uSize: 2, kw: 1.8, ports: 128, psus: 4 },
  oob: { model: "Spectrum SN2201", uSize: 1, kw: 0.2, ports: 48 },
  edge: { model: "WAN edge router", uSize: 2, kw: 1.2 },
  firewall: { model: "Next-gen firewall", uSize: 1, kw: 0.6 },
  ufm: { model: "UFM Enterprise appliance", uSize: 1, kw: 0.5 },
  nas: { model: "All-flash NVMe storage node", uSize: 4, kw: 2.2, usableTb: 500 },
  mgmt: { model: "1U management server", uSize: 1, kw: 0.8 },
} as const;

/** Power and space a network rack may take before the packer opens another. */
export const NETWORK_RACK = { maxKw: 30, reservedTopU: 2 } as const;

export type PduId = "208v_60a" | "415v_32a" | "415v_60a";

/**
 * A switched rack PDU of each rating: the kW one carries continuously (80% of
 * its breaker on a North American circuit, the full 32A on an IEC one) and its
 * C13/C19 outlets. Outlet counts are PLACEHOLDERS for a vertical 0U unit.
 */
export const PDU_RATINGS: Record<PduId, { label: string; kw: number; outlets: number }> = {
  "208v_60a": { label: "208V 3-phase 60A", kw: 17.3, outlets: 48 },
  "415v_32a": { label: "415V 3-phase 32A", kw: 23, outlets: 48 },
  "415v_60a": { label: "415V 3-phase 60A", kw: 34.5, outlets: 48 },
};

export const DEFAULT_PDU: PduId = "415v_60a";

/** Host adapters in each fabric manager appliance, each licensed like a GPU's. */
export const UFM_HCAS = 2;

export const LAYER_OF: Record<PartKind, Layer> = {
  gpu: "compute",
  leaf: "network",
  spine: "network",
  storageSwitch: "network",
  oob: "network",
  edge: "network",
  firewall: "network",
  ufm: "management",
  nas: "storage",
  mgmt: "management",
  manifold: "rack",
  panel: "rack",
};

export const LAYER_LABELS: Record<Layer, string> = {
  compute: "Compute",
  network: "Network",
  storage: "Storage",
  management: "Management",
  rack: "Racks & cabling",
};

export const KIND_LABELS: Record<PartKind, string> = {
  gpu: "GPU node",
  leaf: "Leaf switch",
  spine: "Spine switch",
  storageSwitch: "Storage switch",
  oob: "Out-of-band switch",
  edge: "Edge router",
  firewall: "Firewall",
  ufm: "Fabric manager",
  nas: "Storage node",
  mgmt: "Management server",
  manifold: "Coolant manifold",
  panel: "Fiber patch panel",
};

/** Head, login, provisioning and monitoring servers for a cluster of `nodes`. */
export const mgmtServersFor = (nodes: number) => (nodes <= 16 ? 3 : nodes <= 64 ? 5 : nodes <= 128 ? 8 : 12);
