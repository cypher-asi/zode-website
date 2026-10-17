import {
  DEFAULT_PDU,
  PDU_RATINGS,
  PLATFORMS,
  STORAGE_PER_NODE,
  SUPPORT,
  type PduId,
} from "@/features/cluster/model/catalog";
import type { Cooling, Networking, Platform } from "../types";

/*
 * What a deployment is built from beyond its platform and nodes: the choices
 * a GPU offtaker specifies, from the GPU fabric and its optics to storage,
 * management, power and support. Each phase takes the deployment's, with
 * what it overrides, and its BOM's slots (../bom/slots.ts) are sized and
 * specified from the result. Stored as JSON (deployments.configuration and
 * deployment_phases.config_overrides) and read back through
 * `readConfiguration`, so options can come and go without a migration.
 * Capacities here are PLACEHOLDERS for planning, like the cluster builder's.
 */

/** A GPU system as the BOM sizes it. Rack-scale systems count their compute trays as nodes. */
export interface System {
  label: string;
  rackScale: boolean;
  gpusPerNode: number;
  /** GPU fabric NICs per node, one rail each. */
  nicsPerNode: number;
  railGbps: number;
  nodeKw: number;
  /** Compute trays in one rack-scale rack; null for HGX nodes, racked as the configuration's density says. */
  nodesPerRack: number | null;
  /** NVLink switch trays and power shelves in one rack-scale rack. */
  switchTrays: number;
  powerShelves: number;
  /** What one node holds, for slot specs. */
  detail: string;
}

export const SYSTEMS: Record<Platform, System> = {
  b300: {
    label: PLATFORMS.b300.label,
    rackScale: false,
    gpusPerNode: 8,
    nicsPerNode: 8,
    railGbps: PLATFORMS.b300.railGbps,
    nodeKw: PLATFORMS.b300.nodeKw,
    nodesPerRack: null,
    switchTrays: 0,
    powerShelves: 0,
    detail: `8 x B300 ${PLATFORMS.b300.gpuMemoryGb} GB, ${PLATFORMS.b300.nic}`,
  },
  b200: {
    label: PLATFORMS.b200.label,
    rackScale: false,
    gpusPerNode: 8,
    nicsPerNode: 8,
    railGbps: PLATFORMS.b200.railGbps,
    nodeKw: PLATFORMS.b200.nodeKw,
    nodesPerRack: null,
    switchTrays: 0,
    powerShelves: 0,
    detail: `8 x B200 ${PLATFORMS.b200.gpuMemoryGb} GB, ${PLATFORMS.b200.nic}`,
  },
  gb200_nvl72: {
    label: "NVIDIA GB200 NVL72",
    rackScale: true,
    gpusPerNode: 4,
    nicsPerNode: 4,
    railGbps: 400,
    nodeKw: 7.3,
    nodesPerRack: 18,
    switchTrays: 9,
    powerShelves: 8,
    detail: "Compute tray: 4 x B200 and 2 x Grace, 4 x ConnectX-7 400G",
  },
  gb300_nvl72: {
    label: "NVIDIA GB300 NVL72",
    rackScale: true,
    gpusPerNode: 4,
    nicsPerNode: 4,
    railGbps: 800,
    nodeKw: 7.9,
    nodesPerRack: 18,
    switchTrays: 9,
    powerShelves: 8,
    detail: "Compute tray: 4 x B300 and 2 x Grace, 4 x ConnectX-8 800G",
  },
  // Counted in GPU dies, 8 to a tray, as NVL144 names it; its power is the earlier per-node PLACEHOLDER.
  vera_rubin: {
    label: "NVIDIA Vera Rubin NVL144",
    rackScale: true,
    gpusPerNode: 8,
    nicsPerNode: 4,
    railGbps: 1600,
    nodeKw: 21,
    nodesPerRack: 18,
    switchTrays: 9,
    powerShelves: 8,
    detail: "Compute tray: 4 x Rubin (8 GPU dies) and 2 x Vera, 4 x ConnectX-9 1.6T",
  },
};

export { PDU_RATINGS };

export type StoragePlatform = "vast" | "weka" | "ddn" | "pure" | "generic";

/** Shared storage as each platform builds it: its nodes, what one holds, the fewest a cluster runs on, and its software. */
export const STORAGE_PLATFORMS: Record<
  StoragePlatform,
  { label: string; node: string; usableTb: number; minNodes: number; software: string }
> = {
  vast: { label: "VAST Data", node: "VAST EBox", usableTb: 100, minNodes: 8, software: "VAST Data platform subscription" },
  weka: { label: "WEKA", node: "WEKA storage server", usableTb: 120, minNodes: 8, software: "WEKA Data Platform subscription" },
  ddn: { label: "DDN", node: "DDN AI400X3 appliance", usableTb: 500, minNodes: 1, software: "DDN EXAScaler licenses" },
  pure: { label: "Pure Storage", node: "Pure FlashBlade//S chassis", usableTb: 1000, minNodes: 1, software: "Purity//FB subscription" },
  generic: {
    label: "All-flash NVMe",
    node: SUPPORT.nas.model,
    usableTb: SUPPORT.nas.usableTb,
    minNodes: 2,
    software: "Parallel file system licenses",
  },
};

/** Everything a deployment configures besides its platform, nodes and the columns it had first (`ColumnConfig`). */
export interface DeploymentConfig {
  cpu: "xeon6" | "epyc";
  memoryTb: number;
  nvmeDrives: number;
  nvmeDriveTb: number;
  frontEndNic: "b3220" | "b3240" | "cx7";
  oversubscription: number;
  ufm: "enterprise" | "telemetry" | "none";
  networkMonitoring: boolean;
  optics: "dr4" | "sr" | "lpo" | "cpo" | "aoc";
  opticsSource: "oem" | "compatible";
  cabling: "direct" | "structured";
  storageNetwork: "converged" | "dedicated";
  wan: "2x100" | "4x100" | "2x400";
  edge: "border_leaf" | "router";
  firewall: "ha_pair" | "customer";
  storagePlatform: StoragePlatform;
  capacityTierPb: number;
  /** Per cluster; 0 sizes them to the cluster. */
  mgmtNodes: number;
  orchestration: "customer" | "slurm" | "kubernetes" | "bcm";
  aiEnterprise: boolean;
  rackU: number;
  density: number;
  cdu: "in_rack" | "in_row" | "facility";
  power: "2n" | "n";
  pdu: PduId;
  pduBrand: "any" | "vertiv" | "raritan" | "servertech" | "apc" | "eaton";
  integration: "offsite" | "onsite";
  burnIn: boolean;
  supportYears: number;
  supportLevel: "parts" | "nbd" | "4hr";
  sparesPct: number;
}

/** The configuration kept in the deployment's own columns. */
export interface ColumnConfig {
  cooling: Cooling;
  networking: Networking;
  storageTbPerNode: number;
}

/** One phase's configuration: the deployment's, what the phase overrides, and its platform. */
export interface ResolvedConfig extends DeploymentConfig, ColumnConfig {
  platform: Platform;
}

export type ConfigKey = keyof DeploymentConfig | keyof ColumnConfig;
export type ConfigOverrides = Partial<Pick<ResolvedConfig, ConfigKey>>;

/** What a new deployment starts with, which is also what one saved before configurations reads as. */
export const DEFAULT_CONFIG: DeploymentConfig = {
  cpu: "xeon6",
  memoryTb: 3,
  nvmeDrives: 8,
  nvmeDriveTb: 3.84,
  frontEndNic: "b3220",
  oversubscription: 1,
  ufm: "enterprise",
  networkMonitoring: true,
  optics: "dr4",
  opticsSource: "oem",
  cabling: "direct",
  storageNetwork: "converged",
  wan: "2x100",
  edge: "border_leaf",
  firewall: "ha_pair",
  storagePlatform: "generic",
  capacityTierPb: 0,
  mgmtNodes: 0,
  orchestration: "customer",
  aiEnterprise: false,
  rackU: 42,
  density: 8,
  cdu: "in_rack",
  power: "2n",
  pdu: DEFAULT_PDU,
  pduBrand: "any",
  integration: "offsite",
  burnIn: false,
  supportYears: 3,
  supportLevel: "nbd",
  sparesPct: 0,
};

export type ConfigGroup = "compute" | "fabric" | "optics" | "network" | "storage" | "management" | "rack" | "services";

export const CONFIG_GROUPS: readonly { id: ConfigGroup; label: string }[] = [
  { id: "compute", label: "Compute" },
  { id: "fabric", label: "GPU fabric" },
  { id: "optics", label: "Optics and cabling" },
  { id: "network", label: "Front-end, storage and WAN network" },
  { id: "storage", label: "Storage" },
  { id: "management", label: "Management and software" },
  { id: "rack", label: "Racks, power and cooling" },
  { id: "services", label: "Services, support and spares" },
];

type Value = string | number | boolean;

export interface ConfigField {
  key: ConfigKey;
  group: ConfigGroup;
  label: string;
  options: readonly { value: Value; label: string }[];
  /** For a number typed in rather than chosen: any in `min` to `max`, to the hundredth, shown with `unit`. */
  range?: { min: number; max: number; unit: string };
  /** Whether it applies to configuration `c`; one that doesn't is hidden and leaves the BOM alone. */
  applies?: (c: ResolvedConfig) => boolean;
}

const field = <K extends ConfigKey>(f: {
  key: K;
  group: ConfigGroup;
  label: string;
  options: readonly { value: ResolvedConfig[K]; label: string }[];
  range?: { min: number; max: number; unit: string };
  applies?: (c: ResolvedConfig) => boolean;
}): ConfigField => f;

const hgx = (c: ResolvedConfig) => !SYSTEMS[c.platform].rackScale;
const counted = (values: readonly number[], label: (n: number) => string) => values.map((value) => ({ value, label: label(value) }));

export const COOLING = [
  { value: "liquid_dtc", label: "Liquid DTC" },
  { value: "air", label: "Air" },
] as const satisfies readonly { value: Cooling; label: string }[];

export const NETWORKING = [
  { value: "infiniband", label: "InfiniBand" },
  { value: "roce", label: "Spectrum-X (RoCEv2)" },
  { value: "ethernet", label: "Ethernet (RoCEv2)" },
] as const satisfies readonly { value: Networking; label: string }[];

export const CONFIG_FIELDS: readonly ConfigField[] = [
  field({ key: "cooling", group: "compute", label: "Cooling", options: COOLING, applies: hgx }),
  field({
    key: "cpu",
    group: "compute",
    label: "CPU",
    options: [
      { value: "xeon6", label: "Intel Xeon 6" },
      { value: "epyc", label: "AMD EPYC 9005" },
    ],
    applies: hgx,
  }),
  field({ key: "memoryTb", group: "compute", label: "System memory", options: counted([2, 3, 4], (n) => `${n} TB per node`), applies: hgx }),
  field({ key: "nvmeDrives", group: "compute", label: "Local NVMe drives", options: counted([4, 6, 8], (n) => `${n} per node`) }),
  field({ key: "nvmeDriveTb", group: "compute", label: "NVMe drive size", options: counted([3.84, 7.68, 15.36], (n) => `${n} TB`) }),
  field({
    key: "frontEndNic",
    group: "compute",
    label: "Front-end NIC",
    options: [
      { value: "b3220", label: "BlueField-3 B3220, 2 x 200G" },
      { value: "b3240", label: "BlueField-3 B3240, 2 x 400G" },
      { value: "cx7", label: "ConnectX-7, 2 x 200G" },
    ],
  }),

  field({ key: "networking", group: "fabric", label: "GPU fabric", options: NETWORKING }),
  field({
    key: "oversubscription",
    group: "fabric",
    label: "Topology",
    options: [
      { value: 1, label: "Non-blocking" },
      { value: 2, label: "2:1 oversubscribed" },
    ],
  }),
  field({
    key: "ufm",
    group: "fabric",
    label: "Fabric manager",
    options: [
      { value: "enterprise", label: "UFM Enterprise" },
      { value: "telemetry", label: "UFM Telemetry" },
      { value: "none", label: "None" },
    ],
    applies: (c) => c.networking === "infiniband",
  }),
  field({
    key: "networkMonitoring",
    group: "fabric",
    label: "Network monitoring",
    options: [
      { value: true, label: "NetQ licenses" },
      { value: false, label: "None" },
    ],
  }),

  field({
    key: "optics",
    group: "optics",
    label: "Optics",
    options: [
      { value: "dr4", label: "DR4 single-mode, 500 m" },
      { value: "sr", label: "SR multimode, 50 m" },
      { value: "lpo", label: "Linear pluggable (LPO)" },
      { value: "cpo", label: "Co-packaged optics switches" },
      { value: "aoc", label: "Active optical cables" },
    ],
  }),
  field({
    key: "opticsSource",
    group: "optics",
    label: "Optics source",
    options: [
      { value: "oem", label: "NVIDIA" },
      { value: "compatible", label: "Third party, NVIDIA compatible" },
    ],
  }),
  field({
    key: "cabling",
    group: "optics",
    label: "Cabling",
    options: [
      { value: "direct", label: "Direct patch cords" },
      { value: "structured", label: "Structured, trunks and cassettes" },
    ],
    applies: (c) => c.optics !== "aoc",
  }),

  field({
    key: "storageNetwork",
    group: "network",
    label: "Storage network",
    options: [
      { value: "converged", label: "Converged with front-end" },
      { value: "dedicated", label: "Dedicated storage fabric" },
    ],
  }),
  field({
    key: "wan",
    group: "network",
    label: "Internet uplinks",
    options: [
      { value: "2x100", label: "2 x 100G" },
      { value: "4x100", label: "4 x 100G" },
      { value: "2x400", label: "2 x 400G" },
    ],
  }),
  field({
    key: "edge",
    group: "network",
    label: "Edge",
    options: [
      { value: "border_leaf", label: "Border leaf switches" },
      { value: "router", label: "Edge routers" },
    ],
  }),
  field({
    key: "firewall",
    group: "network",
    label: "Firewall",
    options: [
      { value: "ha_pair", label: "HA pair" },
      { value: "customer", label: "Customer-provided" },
    ],
  }),

  field({
    key: "storageTbPerNode",
    group: "storage",
    label: "Shared storage",
    options: STORAGE_PER_NODE.map((tb) => ({ value: tb, label: tb ? `${tb} TB per node` : "None" })),
  }),
  field({
    key: "storagePlatform",
    group: "storage",
    label: "Storage platform",
    options: (Object.keys(STORAGE_PLATFORMS) as StoragePlatform[]).map((value) => ({
      value,
      label: STORAGE_PLATFORMS[value].label,
    })),
    applies: (c) => c.storageTbPerNode > 0,
  }),
  field({
    key: "capacityTierPb",
    group: "storage",
    label: "Capacity tier",
    options: counted([0, 1, 2, 5, 10], (n) => (n ? `${n} PB object storage` : "None")),
  }),

  field({
    key: "mgmtNodes",
    group: "management",
    label: "Management nodes",
    options: counted([0, 3, 4, 5, 6, 8, 10, 12, 16], (n) => (n ? `${n} per cluster` : "Sized to the cluster")),
  }),
  field({
    key: "orchestration",
    group: "management",
    label: "Orchestration",
    options: [
      { value: "customer", label: "Customer's own, bare metal" },
      { value: "slurm", label: "Slurm" },
      { value: "kubernetes", label: "Kubernetes" },
      { value: "bcm", label: "NVIDIA Base Command Manager" },
    ],
  }),
  field({
    key: "aiEnterprise",
    group: "management",
    label: "NVIDIA AI Enterprise",
    options: [
      { value: false, label: "Not included" },
      { value: true, label: "Per-GPU licenses" },
    ],
  }),

  field({ key: "rackU", group: "rack", label: "Cabinet height", options: counted([42, 48], (n) => `${n}U`) }),
  field({ key: "density", group: "rack", label: "Nodes per rack", options: counted([4, 8], (n) => `${n} nodes`), applies: hgx }),
  field({
    key: "cdu",
    group: "rack",
    label: "Coolant distribution",
    options: [
      { value: "in_rack", label: "In-rack CDUs" },
      { value: "in_row", label: "In-row CDUs" },
      { value: "facility", label: "Facility's, not in the BOM" },
    ],
    applies: (c) => c.cooling === "liquid_dtc",
  }),
  field({
    key: "power",
    group: "rack",
    label: "Power redundancy",
    options: [
      { value: "2n", label: "2N, A and B feeds" },
      { value: "n", label: "N, one feed" },
    ],
  }),
  field({
    key: "pdu",
    group: "rack",
    label: "Rack PDUs",
    options: (Object.keys(PDU_RATINGS) as DeploymentConfig["pdu"][]).map((value) => ({
      value,
      label: `${PDU_RATINGS[value].label}, ${PDU_RATINGS[value].kw} kW`,
    })),
  }),
  field({
    key: "pduBrand",
    group: "rack",
    label: "PDU brand",
    options: [
      { value: "any", label: "Any brand" },
      { value: "vertiv", label: "Vertiv Geist" },
      { value: "raritan", label: "Raritan" },
      { value: "servertech", label: "Server Technology" },
      { value: "apc", label: "APC by Schneider Electric" },
      { value: "eaton", label: "Eaton" },
    ],
  }),

  field({
    key: "integration",
    group: "services",
    label: "Integration",
    options: [
      { value: "offsite", label: "Off-site rack integration (L11)" },
      { value: "onsite", label: "On-site" },
    ],
  }),
  field({
    key: "burnIn",
    group: "services",
    label: "Acceptance testing",
    options: [
      { value: true, label: "Burn-in and acceptance" },
      { value: false, label: "None" },
    ],
  }),
  field({ key: "supportYears", group: "services", label: "Support term", options: counted([3, 5], (n) => `${n} years`) }),
  field({
    key: "supportLevel",
    group: "services",
    label: "Support level",
    options: [
      { value: "parts", label: "Parts only (RTV)" },
      { value: "nbd", label: "Next business day on-site" },
      { value: "4hr", label: "4-hour on-site" },
    ],
  }),
  field({ key: "sparesPct", group: "services", label: "Spares", options: [], range: { min: 0, max: 100, unit: "%" } }),
];

const FIELDS = new Map(CONFIG_FIELDS.map((f) => [f.key, f]));

export const configField = (key: ConfigKey): ConfigField => FIELDS.get(key)!;

/** The option of `field` that `raw` stands for, as stored or as a form posts it; undefined when it's none. */
export function optionOf(f: ConfigField, raw: unknown): Value | undefined {
  if (f.range) {
    const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() ? Number(raw) : NaN;
    return Number.isFinite(n) && n >= f.range.min && n <= f.range.max ? Math.round(n * 100) / 100 : undefined;
  }
  const match = f.options.find((option) => option.value === raw || String(option.value) === String(raw));
  return match?.value;
}

/** How `value` of `key` reads, e.g. "2 x 400G", or "None" for a typed-in 0. */
export const valueLabel = (key: ConfigKey, value: unknown): string => {
  const f = configField(key);
  if (f.range) return value ? `${value}${f.range.unit}` : "None";
  return f.options.find((option) => option.value === value)?.label ?? String(value);
};

/** A stored configuration, every setting it lacks or no longer offers taking its default. */
export function readConfiguration(raw: unknown): DeploymentConfig {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: Record<string, Value> = { ...DEFAULT_CONFIG };
  for (const key of Object.keys(DEFAULT_CONFIG) as (keyof DeploymentConfig)[]) {
    const value = optionOf(configField(key), r[key]);
    if (value !== undefined) out[key] = value;
  }
  return out as unknown as DeploymentConfig;
}

/** A phase's stored overrides, keeping only settings it can still override to. */
export function readOverrides(raw: unknown): ConfigOverrides {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: Record<string, Value> = {};
  for (const f of CONFIG_FIELDS) {
    if (!(f.key in r)) continue;
    const value = optionOf(f, r[f.key]);
    if (value !== undefined) out[f.key] = value;
  }
  return out as ConfigOverrides;
}
