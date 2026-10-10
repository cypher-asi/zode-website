import type { PodId } from "../future-home/pod/podTour";

/*
 * Option lists, sizing assumptions and the price model behind the Own Compute
 * configurator. Every dollar figure and ratio here is a PLACEHOLDER estimate
 * for planning conversations, not a quote; edit them in place.
 */

/** Part of the drawing an option points at: which pod to show and which zone to warm up. */
export interface Focus {
  pod: PodId;
  zone: string | null;
}

export interface Choice<Id extends string> {
  id: Id;
  label: string;
  detail: string;
  /** Shown on the right of the option card, e.g. "+$38k / node" or "Included". */
  note?: string;
  disabled?: boolean;
  badge?: string;
  focus?: Focus;
}

export const ASSUMPTIONS = {
  gpusPerNode: 8,
  /** 8 compute racks x 4 HGX nodes in each ZODE compute pod. */
  nodesPerZode: 32,
  /** IT draw of one HGX B300 node, kW. */
  nodeKw: 14.3,
  /** Facility overhead with direct-to-chip liquid cooling. */
  pue: 1.15,
  /** Electrical, cooling and compute pods, delivered and commissioned, per ZODE. */
  zodeInfrastructure: 1_800_000,
  financing: {
    downPayment: 0.1,
    months: 36,
    apr: 0.095,
  },
} as const;

/** The only cluster sizes offered, in nodes: 64 doubling up. */
export const NODE_SIZES = [64, 128, 256, 512, 1024] as const;

export type PlatformId = "b300" | "vera-rubin";
export type WorkloadId = "training" | "inference";
export type DeploymentId = "bare-metal" | "virtualized";
export type NetworkId = "infiniband" | "roce";
export type RedundancyId =
  | "gensets"
  | "cooling"
  | "pumps"
  | "utility"
  | "fiber"
  | "ups"
  | "transformer"
  | "spine"
  | "fuel";

const RACKS: Focus = { pod: "compute", zone: "racks" };

/** Price per node, by platform. */
export const NODE_PRICE: Record<PlatformId, number> = {
  b300: 425_000,
  "vera-rubin": 0,
};

export const PLATFORMS: readonly Choice<PlatformId>[] = [
  { id: "b300", label: "NVIDIA B300", detail: "HGX B300 · 8 GPUs per node", note: "$425k / node", focus: RACKS },
  {
    id: "vera-rubin",
    label: "NVIDIA Vera Rubin",
    detail: "Next-generation Rubin GPUs with Vera CPUs",
    disabled: true,
    badge: "Coming soon",
    focus: RACKS,
  },
];

export const COOLING: Choice<"dtc"> = {
  id: "dtc",
  label: "DTC Liquid",
  detail: "Direct-to-chip cold plates with rear-door heat exchangers",
  note: "Included",
  focus: { pod: "compute", zone: "coolant" },
};

/** Added cost per node. */
export const WORKLOAD_PRICE: Record<WorkloadId, number> = { training: 18_000, inference: 6_000 };

export const WORKLOADS: readonly Choice<WorkloadId>[] = [
  {
    id: "training",
    label: "Training",
    detail: "High-throughput parallel storage for datasets and checkpoints",
    note: "+$18k / node",
    focus: RACKS,
  },
  {
    id: "inference",
    label: "Inference",
    detail: "Low-latency serving with local NVMe on every node",
    note: "+$6k / node",
    focus: RACKS,
  },
];

/** Added cost per node. */
export const DEPLOYMENT_PRICE: Record<DeploymentId, number> = { "bare-metal": 0, virtualized: 9_000 };

export const DEPLOYMENTS: readonly Choice<DeploymentId>[] = [
  {
    id: "bare-metal",
    label: "Bare Metal",
    detail: "Direct hardware access for full performance",
    note: "Included",
    focus: { pod: "compute", zone: "noc" },
  },
  {
    id: "virtualized",
    label: "Virtualized",
    detail: "Hypervisor and orchestration for isolated tenants",
    note: "+$9k / node",
    focus: { pod: "compute", zone: "noc" },
  },
];

/** Added cost per node. */
export const NETWORK_PRICE: Record<NetworkId, number> = { infiniband: 38_000, roce: 28_000 };

export const NETWORKS: readonly Choice<NetworkId>[] = [
  {
    id: "infiniband",
    label: "InfiniBand",
    detail: "NVIDIA Quantum-X800 · 800 Gb/s per GPU",
    note: "+$38k / node",
    focus: { pod: "compute", zone: "spine" },
  },
  {
    id: "roce",
    label: "RoCE v2",
    detail: "NVIDIA Spectrum-X Ethernet · 800 Gb/s per GPU",
    note: "+$28k / node",
    focus: { pod: "compute", zone: "spine" },
  },
];

export interface RedundancyChoice extends Choice<RedundancyId> {
  /** Added cost per ZODE. */
  price: number;
  /** Only selectable alongside this item. */
  requires?: RedundancyId;
}

export const REDUNDANCY: readonly RedundancyChoice[] = [
  {
    id: "gensets",
    label: "Gensets",
    detail: "A standby generator beyond what full load needs",
    price: 420_000,
    focus: { pod: "electrical", zone: "switchboard" },
  },
  {
    id: "cooling",
    label: "Cooling",
    detail: "Spare dry-cooler and heat-exchanger capacity",
    price: 160_000,
    focus: { pod: "cooling", zone: "hx" },
  },
  {
    id: "pumps",
    label: "Pumps",
    detail: "A standby pump on each coolant loop",
    price: 45_000,
    focus: { pod: "cooling", zone: "pumps" },
  },
  {
    id: "utility",
    label: "Utility Power",
    detail: "A second utility feed from a separate substation",
    price: 250_000,
    focus: { pod: "electrical", zone: "transformer" },
  },
  {
    id: "fiber",
    label: "Fiber",
    detail: "Diverse carrier routes, each in its own conduit",
    price: 35_000,
    focus: { pod: "compute", zone: "fiber-a" },
  },
  {
    id: "ups",
    label: "UPS + Battery",
    detail: "An extra UPS module and battery string",
    price: 140_000,
    focus: { pod: "electrical", zone: "ups" },
  },
  {
    id: "transformer",
    label: "Transformer",
    detail: "Spare medium-voltage transformer capacity",
    price: 180_000,
    focus: { pod: "electrical", zone: "transformer" },
  },
  {
    id: "spine",
    label: "Network Spine",
    detail: "A spare spine switch in every fabric plane",
    price: 60_000,
    focus: { pod: "compute", zone: "spine" },
  },
  {
    id: "fuel",
    label: "Fuel Autonomy",
    detail: "48 hours of on-site fuel for the gensets",
    price: 55_000,
    requires: "gensets",
    focus: { pod: "electrical", zone: null },
  },
];

export interface Config {
  platform: PlatformId;
  nodes: number;
  workload: WorkloadId;
  deployment: DeploymentId;
  network: NetworkId;
  redundancy: readonly RedundancyId[];
}

export const DEFAULT_CONFIG: Config = {
  platform: "b300",
  nodes: 64,
  workload: "training",
  deployment: "bare-metal",
  network: "infiniband",
  redundancy: ["pumps", "fiber"],
};

export interface LineItem {
  label: string;
  detail: string;
  amount: number;
}

export interface Quote {
  nodes: number;
  gpus: number;
  zodes: number;
  mw: number;
  lineItems: LineItem[];
  total: number;
  downPayment: number;
  monthly: number;
}

/** The offered size closest to `n`. */
export const snapNodes = (n: number): number =>
  NODE_SIZES.reduce((best, size) => (Math.abs(size - n) < Math.abs(best - n) ? size : best), NODE_SIZES[0]);

const label = <Id extends string>(list: readonly Choice<Id>[], id: Id) => list.find((c) => c.id === id)?.label ?? id;

/** Fixed monthly payment that pays `principal` off over `months` at `apr`. */
function amortize(principal: number, apr: number, months: number): number {
  const r = apr / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - (1 + r) ** -months);
}

/** Selected N+1 items whose prerequisite is also selected. */
export function activeRedundancy(config: Config): RedundancyChoice[] {
  return REDUNDANCY.filter(
    (r) => config.redundancy.includes(r.id) && (!r.requires || config.redundancy.includes(r.requires)),
  );
}

export function quote(config: Config): Quote {
  const nodes = snapNodes(config.nodes);
  const gpus = nodes * ASSUMPTIONS.gpusPerNode;
  const zodes = Math.ceil(nodes / ASSUMPTIONS.nodesPerZode);
  const mw = (nodes * ASSUMPTIONS.nodeKw * ASSUMPTIONS.pue) / 1000;
  const per = (n: number) => `${nodes} x $${(n / 1000).toLocaleString("en-US")}k`;
  const perZode = zodes === 1 ? "1 ZODE" : `${zodes} ZODEs`;

  const redundant = activeRedundancy(config);

  const lineItems: LineItem[] = [
    {
      label: `${label(PLATFORMS, config.platform)} nodes`,
      detail: per(NODE_PRICE[config.platform]),
      amount: nodes * NODE_PRICE[config.platform],
    },
    { label: "DTC liquid cooling", detail: "Included", amount: 0 },
    {
      label: `${label(WORKLOADS, config.workload)} storage`,
      detail: per(WORKLOAD_PRICE[config.workload]),
      amount: nodes * WORKLOAD_PRICE[config.workload],
    },
    {
      label: label(DEPLOYMENTS, config.deployment),
      detail: DEPLOYMENT_PRICE[config.deployment] ? per(DEPLOYMENT_PRICE[config.deployment]) : "Included",
      amount: nodes * DEPLOYMENT_PRICE[config.deployment],
    },
    {
      label: `${label(NETWORKS, config.network)} fabric`,
      detail: per(NETWORK_PRICE[config.network]),
      amount: nodes * NETWORK_PRICE[config.network],
    },
    {
      label: "ZODE infrastructure",
      detail: perZode,
      amount: zodes * ASSUMPTIONS.zodeInfrastructure,
    },
    {
      label: `N+1 redundancy (${redundant.length})`,
      detail: redundant.length ? perZode : "None selected",
      amount: zodes * redundant.reduce((sum, r) => sum + r.price, 0),
    },
  ];

  const total = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const { downPayment: down, apr, months } = ASSUMPTIONS.financing;
  const downPayment = total * down;
  const monthly = amortize(total - downPayment, apr, months);

  return { nodes, gpus, zodes, mw, lineItems, total, downPayment, monthly };
}

export function summarize(config: Config): string {
  const nodes = snapNodes(config.nodes);
  return [
    label(PLATFORMS, config.platform),
    `${nodes} node${nodes === 1 ? "" : "s"}`,
    label(WORKLOADS, config.workload),
    label(DEPLOYMENTS, config.deployment),
    label(NETWORKS, config.network),
    `${activeRedundancy(config).length} x N+1`,
  ].join(" · ");
}

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const usd = (n: number): string => USD.format(Math.round(n));

/** Short form for large totals, e.g. "$18.4M". */
export function usdShort(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}k`;
  return usd(n);
}
