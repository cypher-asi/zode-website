import type { PodId } from "@/features/zode-drawings/podTour";

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

/** `F` is what hovering the option points at in the drawing: a cabin `Focus` when buying, a rack kind when renting. */
export interface Choice<Id extends string, F = Focus> {
  id: Id;
  label: string;
  detail?: string;
  /** Shown on the right of the option card, e.g. "+$38k / node" or "Included". */
  note?: string;
  disabled?: boolean;
  badge?: string;
  focus?: F;
}

export const ASSUMPTIONS = {
  gpusPerNode: 8,
  /** 8 compute racks x 8 HGX nodes in each ZODE compute pod. */
  nodesPerZode: 64,
  /** Critical IT load per HGX B300 node, kW, with its share of the network racks. */
  nodeKw: 15.625,
  /** Facility overhead with direct-to-chip liquid cooling and chiller trim. */
  pue: 1.3,
  /** Electrical, cooling and compute pods per ZODE, equipment only: excludes freight, install and engineering. */
  zodeInfrastructure: 2_616_094,
  /** Non-revenue spare equipment, a share of node and IT cost. */
  spareShare: 0.01,
  /** Deployment and setup, once per cluster. */
  setupCost: 250_000,
  financing: {
    downPayment: 0.2,
    months: 36,
    apr: 0.12,
  },
} as const;

/** The only cluster sizes offered, in nodes: 64 doubling up. */
export const NODE_SIZES = [64, 128, 256, 512, 1024] as const;

export type LocationId = "usa" | "canada";
export type PlatformId = "b300" | "vera-rubin";
export type WorkloadId = "training" | "inference";
export type DeploymentId = "bare-metal" | "virtualized";
export type NetworkId = "infiniband" | "roce";
export type RedundancyId =
  | "gensets"
  | "cooling"
  | "utility"
  | "fiber"
  | "ups"
  | "transformer"
  | "spine"
  | "fuel";

const RACKS: Focus = { pod: "compute", zone: "racks" };

export const LOCATIONS: readonly Choice<LocationId>[] = [
  { id: "usa", label: "USA" },
  { id: "canada", label: "Canada" },
];

/** Price per node, by platform. */
const NODE_PRICE: Record<PlatformId, number> = {
  b300: 550_000,
  "vera-rubin": 0,
};

export const PLATFORMS: readonly Choice<PlatformId>[] = [
  { id: "b300", label: "NVIDIA B300", detail: "8 GPUs per node", note: "$550k / node", focus: RACKS },
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
const WORKLOAD_PRICE: Record<WorkloadId, number> = { training: 28_000, inference: 9_000 };

export const WORKLOADS: readonly Choice<WorkloadId>[] = [
  {
    id: "training",
    label: "Training",
    detail: "High-throughput parallel storage for datasets and checkpoints",
    note: "+$28k / node",
    focus: RACKS,
  },
  {
    id: "inference",
    label: "Inference",
    detail: "Low-latency serving with local NVMe on every node",
    note: "+$9k / node",
    focus: RACKS,
  },
];

/** Added cost per node. */
const DEPLOYMENT_PRICE: Record<DeploymentId, number> = { "bare-metal": 0, virtualized: 9_000 };

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
const NETWORK_PRICE: Record<NetworkId, number> = { infiniband: 60_000, roce: 44_000 };

export const NETWORKS: readonly Choice<NetworkId>[] = [
  {
    id: "infiniband",
    label: "InfiniBand",
    detail: "NVIDIA Quantum-X800 · 800 Gb/s per GPU",
    note: "+$60k / node",
    focus: { pod: "compute", zone: "spine" },
  },
  {
    id: "roce",
    label: "RoCE v2",
    detail: "NVIDIA Spectrum-X Ethernet · 800 Gb/s per GPU",
    note: "+$44k / node",
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
    detail: "Standby generation for the full facility load",
    price: 750_000,
    focus: { pod: "electrical", zone: "switchboard" },
  },
  {
    id: "cooling",
    label: "Cooling",
    detail: "Spare dry-cooler and heat-exchanger capacity",
    price: 134_000,
    focus: { pod: "cooling", zone: "hx" },
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
    price: 95_000,
    focus: { pod: "electrical", zone: "ups" },
  },
  {
    id: "transformer",
    label: "Transformer",
    detail: "Spare medium-voltage transformer capacity",
    price: 183_000,
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
  location: LocationId;
  platform: PlatformId;
  nodes: number;
  workload: WorkloadId;
  deployment: DeploymentId;
  network: NetworkId;
  redundancy: readonly RedundancyId[];
}

export const DEFAULT_CONFIG: Config = {
  location: "usa",
  platform: "b300",
  nodes: 64,
  workload: "training",
  deployment: "bare-metal",
  network: "infiniband",
  redundancy: ["fiber"],
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
const snapNodes = (n: number): number =>
  NODE_SIZES.reduce((best, size) => (Math.abs(size - n) < Math.abs(best - n) ? size : best), NODE_SIZES[0]);

export const label = <Id extends string, F>(list: readonly Choice<Id, F>[], id: Id) =>
  list.find((c) => c.id === id)?.label ?? id;

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
  const hardware =
    nodes * (NODE_PRICE[config.platform] + WORKLOAD_PRICE[config.workload] + NETWORK_PRICE[config.network]);

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
      label: "Spare equipment",
      detail: `${Math.round(ASSUMPTIONS.spareShare * 100)}% of nodes, storage and fabric`,
      amount: hardware * ASSUMPTIONS.spareShare,
    },
    {
      label: "ZODE infrastructure",
      detail: perZode,
      amount: zodes * ASSUMPTIONS.zodeInfrastructure,
    },
    { label: "Deployment and setup", detail: "Per cluster", amount: ASSUMPTIONS.setupCost },
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

export interface Stat {
  label: string;
  value: string;
}

export interface Summary {
  /** What was picked, by name. */
  choices: Stat[];
  /** What it adds up to, by count. */
  cluster: Stat[];
}

/** The price panel's two rows of figures; both are five long so they share columns. */
function summarize(config: Config, quote: Quote): Summary {
  return {
    choices: [
      { label: "Location", value: label(LOCATIONS, config.location) },
      { label: "Platform", value: label(PLATFORMS, config.platform).replace(/^NVIDIA /, "") },
      { label: "Workload", value: label(WORKLOADS, config.workload) },
      { label: "Deployment", value: label(DEPLOYMENTS, config.deployment) },
      { label: "Network", value: label(NETWORKS, config.network) },
    ],
    cluster: [
      { label: "GPUs", value: quote.gpus.toLocaleString("en-US") },
      { label: "Nodes", value: quote.nodes.toLocaleString("en-US") },
      { label: quote.zodes === 1 ? "ZODE" : "ZODEs", value: String(quote.zodes) },
      { label: "Est. power", value: `${quote.mw.toFixed(2)} MW` },
      { label: "N+1 systems", value: `${activeRedundancy(config).length} of ${REDUNDANCY.length}` },
    ],
  };
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

export interface PriceRow {
  label: string;
  detail?: string;
  value: string;
  /** Ruled off above, in bold. */
  total?: boolean;
}

/** What the price panel shows, whichever way the compute is paid for. */
export interface PriceView {
  /** The big tweened figure. */
  headline: {
    value: number;
    format: (n: number) => string;
    unit: string;
    caption: string;
    /** Trails the caption; the first thing dropped when the panel narrows. */
    terms?: string;
  };
  /** A smaller fixed figure set before the headline. */
  secondary?: { value: string; unit: string; caption: string };
  breakdown: {
    title: string;
    total: string;
    rows: LineItem[];
    /** Rows after the line items, such as the total and payment terms. */
    footer: PriceRow[];
    fineprint: string;
  };
  summary: Summary;
}

export function buyPriceView(config: Config, quote: Quote): PriceView {
  const { downPayment: down, apr, months } = ASSUMPTIONS.financing;
  return {
    headline: {
      value: quote.monthly,
      format: usd,
      unit: "/mo",
      caption: "Est. monthly",
      terms: `${Math.round(down * 100)}% down · ${months} mo · ${(apr * 100).toFixed(1)}% APR`,
    },
    breakdown: {
      title: "Est. total cost",
      total: usd(quote.total),
      rows: quote.lineItems,
      footer: [
        { label: "Total", value: usd(quote.total), total: true },
        { label: `Due at signing (${Math.round(down * 100)}%)`, value: usd(quote.downPayment) },
        { label: "Monthly", detail: `${months} mo at ${(apr * 100).toFixed(1)}% APR`, value: usd(quote.monthly) },
      ],
      fineprint:
        "Placeholder estimates for planning only. Excludes site work, sales and use tax, power and freight.",
    },
    summary: summarize(config, quote),
  };
}
