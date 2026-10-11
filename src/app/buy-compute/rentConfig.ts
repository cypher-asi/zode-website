import {
  ASSUMPTIONS,
  COOLING,
  LOCATIONS,
  label,
  usd,
  usdShort,
  type Choice,
  type LineItem,
  type LocationId,
  type NetworkId,
  type PlatformId,
  type PriceView,
  type Summary,
} from "./config";

/*
 * Option lists, sizing assumptions and the price model behind the Rent
 * Compute configurator. Every rate, ratio and rack density here is a
 * PLACEHOLDER estimate for planning conversations, not a quote; edit them in place.
 */

/** The kinds of rack in the drawing; options point at the one they add to. */
export type RackKind = "gpu" | "network" | "storage" | "cpu" | "mgmt";

export type RentChoice<Id extends string> = Choice<Id, RackKind>;

export const RENT_ASSUMPTIONS = {
  hoursPerMonth: 730,
  nodesPerRack: 4,
  /** GPU nodes served by one rack of leaf and spine switches. */
  nodesPerNetworkRack: 32,
  cpuMachinesPerRack: 16,
  /** Local NVMe on every GPU node, TB. */
  localTbPerNode: 30,
} as const;

/** The only cluster sizes offered, in nodes: one rack doubling up. */
export const RENT_NODE_SIZES = [4, 8, 16, 32, 64, 128, 256] as const;

export type FrontEndId = "200g" | "400g";
export type UplinkId = "10g" | "100g" | "400g";
export type StorageTierId = "parallel" | "file" | "object";
export type HostCpuId = "xeon" | "epyc";
export type CpuMachineId = "epyc-192" | "xeon-128";

export const STORAGE_SIZES = [0, 100, 500, 1_000, 5_000] as const;
export const CPU_MACHINE_COUNTS = [0, 4, 8, 16, 32] as const;
export const MGMT_COUNTS = [3, 5, 7] as const;

const MGMT_INCLUDED = 3;
/** Each management server past the included three, per month. */
const MGMT_PRICE = 650;

export const RENT_LOCATIONS: readonly RentChoice<LocationId>[] = LOCATIONS.map((c) => ({ ...c, focus: "gpu" as const }));

/** Base rate, $ per GPU-hour. */
const GPU_HOUR: Record<PlatformId, number> = { b300: 3.2, "vera-rubin": 0 };

export const RENT_PLATFORMS: readonly RentChoice<PlatformId>[] = [
  { id: "b300", label: "NVIDIA B300", detail: "8 GPUs per node", note: "$3.20 / GPU/hr", focus: "gpu" },
  {
    id: "vera-rubin",
    label: "NVIDIA Vera Rubin",
    detail: "Next-generation Rubin GPUs with Vera CPUs",
    disabled: true,
    badge: "Coming soon",
    focus: "gpu",
  },
];

export const RENT_COOLING: RentChoice<"dtc"> = { ...COOLING, focus: "gpu" };

/** Added $ per GPU-hour. */
const FABRIC_HOUR: Record<NetworkId, number> = { infiniband: 0.18, roce: 0.1 };

export const FABRICS: readonly RentChoice<NetworkId>[] = [
  {
    id: "infiniband",
    label: "InfiniBand",
    detail: "NVIDIA Quantum-X800 · 800 Gb/s per GPU",
    note: "+$0.18 / GPU/hr",
    focus: "network",
  },
  {
    id: "roce",
    label: "RoCE v2",
    detail: "NVIDIA Spectrum-X Ethernet · 800 Gb/s per GPU",
    note: "+$0.10 / GPU/hr",
    focus: "network",
  },
];

/** Added $ per GPU-hour. */
const FRONT_END_HOUR: Record<FrontEndId, number> = { "200g": 0, "400g": 0.04 };

export const FRONT_ENDS: readonly RentChoice<FrontEndId>[] = [
  { id: "200g", label: "200 GbE", detail: "Per node, for storage and management traffic", note: "Included", focus: "network" },
  { id: "400g", label: "400 GbE", detail: "Per node, for data-heavy pipelines", note: "+$0.04 / GPU/hr", focus: "network" },
];

/** $ per month for the whole cluster. */
const UPLINK_PRICE: Record<UplinkId, number> = { "10g": 0, "100g": 4_500, "400g": 15_000 };

export const UPLINKS: readonly RentChoice<UplinkId>[] = [
  { id: "10g", label: "10 Gbps", note: "Included", focus: "network" },
  { id: "100g", label: "100 Gbps", note: "+$4.5k / mo", focus: "network" },
  { id: "400g", label: "400 Gbps", note: "+$15k / mo", focus: "network" },
];

export const LOCAL_STORAGE: RentChoice<"nvme"> = {
  id: "nvme",
  label: "Local NVMe",
  detail: `${RENT_ASSUMPTIONS.localTbPerNode} TB on every GPU node`,
  note: "Included",
  focus: "gpu",
};

/** $ per TB per month. */
export const STORAGE_TB_PRICE: Record<StorageTierId, number> = { parallel: 60, file: 25, object: 12 };

/** Usable TB in one storage rack. */
export const STORAGE_TB_PER_RACK: Record<StorageTierId, number> = { parallel: 1_000, file: 2_000, object: 4_000 };

export const STORAGE_TIERS: readonly RentChoice<StorageTierId>[] = [
  {
    id: "parallel",
    label: "Parallel file system",
    detail: "All-flash, for training datasets and checkpoints",
    note: "$60 / TB/mo",
    focus: "storage",
  },
  {
    id: "file",
    label: "Standard file storage",
    detail: "NFS shares for home directories and shared tooling",
    note: "$25 / TB/mo",
    focus: "storage",
  },
  {
    id: "object",
    label: "Object storage",
    detail: "S3-compatible, for archives and model weights",
    note: "$12 / TB/mo",
    focus: "storage",
  },
];

/** Added $ per GPU-hour. */
const HOST_CPU_HOUR: Record<HostCpuId, number> = { xeon: 0, epyc: 0.03 };

/** CPU cores in each GPU node. */
const HOST_CPU_CORES: Record<HostCpuId, number> = { xeon: 128, epyc: 192 };

export const HOST_CPUS: readonly RentChoice<HostCpuId>[] = [
  { id: "xeon", label: "Intel Xeon 6", detail: "2 sockets · 128 cores per node", note: "Included", focus: "gpu" },
  { id: "epyc", label: "AMD EPYC 9005", detail: "2 sockets · 192 cores per node", note: "+$0.03 / GPU/hr", focus: "gpu" },
];

/** $ per machine-hour. */
export const CPU_MACHINE_HOUR: Record<CpuMachineId, number> = { "epyc-192": 4.1, "xeon-128": 3.4 };

const CPU_MACHINE_CORES: Record<CpuMachineId, number> = { "epyc-192": 192, "xeon-128": 128 };

export const CPU_MACHINES: readonly RentChoice<CpuMachineId>[] = [
  {
    id: "epyc-192",
    label: "AMD EPYC 9965",
    detail: "192 cores · 1.5 TB memory",
    note: "$4.10 / hr",
    focus: "cpu",
  },
  {
    id: "xeon-128",
    label: "Intel Xeon 6980P",
    detail: "128 cores · 1 TB memory",
    note: "$3.40 / hr",
    focus: "cpu",
  },
];

export interface RentConfig {
  location: LocationId;
  platform: PlatformId;
  nodes: number;
  fabric: NetworkId;
  frontEnd: FrontEndId;
  uplink: UplinkId;
  storageTier: StorageTierId;
  storageTb: number;
  hostCpu: HostCpuId;
  cpuMachine: CpuMachineId;
  cpuMachines: number;
  mgmtServers: number;
}

export const DEFAULT_RENT_CONFIG: RentConfig = {
  location: "usa",
  platform: "b300",
  nodes: 16,
  fabric: "infiniband",
  frontEnd: "200g",
  uplink: "10g",
  storageTier: "parallel",
  storageTb: 500,
  hostCpu: "xeon",
  cpuMachine: "epyc-192",
  cpuMachines: 4,
  mgmtServers: 3,
};

export type RackCounts = Record<RackKind, number>;

export interface RentQuote {
  nodes: number;
  gpus: number;
  mw: number;
  racks: RackCounts;
  totalRacks: number;
  /** Cores in the separate CPU machines. */
  cpuCores: number;
  /** Cores in the GPU nodes' host CPUs. */
  hostCores: number;
  lineItems: LineItem[];
  monthly: number;
  /** Base platform rate, $ per GPU-hour. */
  gpuHour: number;
  /** Everything in `monthly`, spread over every GPU-hour. */
  perGpuHour: number;
}

/** The offered size closest to `n`. */
const snapRentNodes = (n: number): number =>
  RENT_NODE_SIZES.reduce(
    (best, size) => (Math.abs(size - n) < Math.abs(best - n) ? size : best),
    RENT_NODE_SIZES[0] as number,
  );

function rackCounts(config: RentConfig): RackCounts {
  const r = RENT_ASSUMPTIONS;
  const nodes = snapRentNodes(config.nodes);
  return {
    mgmt: 1,
    network: Math.max(1, Math.ceil(nodes / r.nodesPerNetworkRack)),
    storage: Math.ceil(config.storageTb / STORAGE_TB_PER_RACK[config.storageTier]),
    cpu: Math.ceil(config.cpuMachines / r.cpuMachinesPerRack),
    gpu: Math.ceil(nodes / r.nodesPerRack),
  };
}

const rate = (n: number) => `$${n.toFixed(2)}`;
const tb = (n: number) => `${n.toLocaleString("en-US")} TB`;

export function rentQuote(config: RentConfig): RentQuote {
  const { hoursPerMonth: hours } = RENT_ASSUMPTIONS;
  const nodes = snapRentNodes(config.nodes);
  const gpus = nodes * ASSUMPTIONS.gpusPerNode;
  const mw = (nodes * ASSUMPTIONS.nodeKw * ASSUMPTIONS.pue) / 1000;
  const racks = rackCounts(config);
  const gpuHour = GPU_HOUR[config.platform];

  /** A $ per GPU-hour rate as a monthly line item. */
  const perGpu = (lbl: string, r: number): LineItem => ({
    label: lbl,
    detail: r ? `${gpus.toLocaleString("en-US")} GPUs x ${rate(r)} / hr` : "Included",
    amount: gpus * r * hours,
  });

  const extraMgmt = Math.max(0, config.mgmtServers - MGMT_INCLUDED);
  const machineHour = CPU_MACHINE_HOUR[config.cpuMachine];

  const lineItems: LineItem[] = [
    perGpu(`${label(RENT_PLATFORMS, config.platform)} GPUs`, gpuHour),
    { label: "DTC liquid cooling", detail: "Included", amount: 0 },
    perGpu(`${label(FABRICS, config.fabric)} fabric`, FABRIC_HOUR[config.fabric]),
    perGpu(`${label(FRONT_ENDS, config.frontEnd)} front end`, FRONT_END_HOUR[config.frontEnd]),
    {
      label: `${label(UPLINKS, config.uplink)} internet`,
      detail: UPLINK_PRICE[config.uplink] ? "Per month" : "Included",
      amount: UPLINK_PRICE[config.uplink],
    },
    { label: "Local NVMe", detail: `${tb(nodes * RENT_ASSUMPTIONS.localTbPerNode)} · Included`, amount: 0 },
    {
      label: label(STORAGE_TIERS, config.storageTier),
      detail: config.storageTb
        ? `${tb(config.storageTb)} x $${STORAGE_TB_PRICE[config.storageTier]} / mo`
        : "None selected",
      amount: config.storageTb * STORAGE_TB_PRICE[config.storageTier],
    },
    perGpu(`${label(HOST_CPUS, config.hostCpu)} host CPUs`, HOST_CPU_HOUR[config.hostCpu]),
    {
      label: `${label(CPU_MACHINES, config.cpuMachine)} machines`,
      detail: config.cpuMachines ? `${config.cpuMachines} x ${rate(machineHour)} / hr` : "None selected",
      amount: config.cpuMachines * machineHour * hours,
    },
    {
      label: `Management servers (${config.mgmtServers})`,
      detail: extraMgmt ? `${MGMT_INCLUDED} included + ${extraMgmt} x ${usd(MGMT_PRICE)} / mo` : "Included",
      amount: extraMgmt * MGMT_PRICE,
    },
  ];

  const monthly = lineItems.reduce((sum, item) => sum + item.amount, 0);

  return {
    nodes,
    gpus,
    mw,
    racks,
    totalRacks: Object.values(racks).reduce((a, b) => a + b, 0),
    cpuCores: config.cpuMachines * CPU_MACHINE_CORES[config.cpuMachine],
    hostCores: nodes * HOST_CPU_CORES[config.hostCpu],
    lineItems,
    monthly,
    gpuHour,
    perGpuHour: gpus ? monthly / (gpus * hours) : 0,
  };
}

/** Management server count note, e.g. "Included" or "+$1.3k / mo". */
export const mgmtNote = (count: number): string => {
  const extra = Math.max(0, count - MGMT_INCLUDED) * MGMT_PRICE;
  return extra ? `+${usdShort(extra)} / mo` : "Included";
};

/** Tier names short enough for one price panel column. */
const STORAGE_SHORT: Record<StorageTierId, string> = { parallel: "Parallel FS", file: "File", object: "Object" };

/** The price panel's two rows of figures; both are five long so they share columns. */
function summarizeRent(config: RentConfig, quote: RentQuote): Summary {
  return {
    choices: [
      { label: "Location", value: label(RENT_LOCATIONS, config.location) },
      { label: "Platform", value: label(RENT_PLATFORMS, config.platform).replace(/^NVIDIA /, "") },
      { label: "Fabric", value: label(FABRICS, config.fabric) },
      { label: "Storage", value: config.storageTb ? STORAGE_SHORT[config.storageTier] : "Local NVMe" },
      { label: "Host CPU", value: label(HOST_CPUS, config.hostCpu).replace(/^(Intel|AMD) /, "") },
    ],
    cluster: [
      { label: "GPUs", value: quote.gpus.toLocaleString("en-US") },
      { label: "Nodes", value: quote.nodes.toLocaleString("en-US") },
      { label: "Racks", value: String(quote.totalRacks) },
      { label: "Shared storage", value: config.storageTb ? tb(config.storageTb) : "None" },
      { label: "Est. power", value: `${quote.mw.toFixed(2)} MW` },
    ],
  };
}

export function rentPriceView(config: RentConfig, quote: RentQuote): PriceView {
  return {
    headline: {
      value: quote.perGpuHour,
      format: rate,
      unit: "/GPU/hr",
      caption: "All-in rate",
      terms: `${quote.gpus.toLocaleString("en-US")} GPUs`,
    },
    secondary: { value: usdShort(quote.monthly), unit: "/mo", caption: "Est. total monthly" },
    breakdown: {
      title: "Est. total monthly",
      total: usd(quote.monthly),
      rows: quote.lineItems,
      footer: [
        { label: "Total per month", value: usd(quote.monthly), total: true },
        { label: "Base GPU rate", detail: label(RENT_PLATFORMS, config.platform), value: `${rate(quote.gpuHour)} / hr` },
        {
          label: "All-in GPU rate",
          detail: `Monthly total over ${RENT_ASSUMPTIONS.hoursPerMonth} hrs per GPU`,
          value: `${rate(quote.perGpuHour)} / hr`,
        },
      ],
      fineprint: "Placeholder estimates for planning only. Excludes taxes and data transfer beyond the uplink.",
    },
    summary: summarizeRent(config, quote),
  };
}
