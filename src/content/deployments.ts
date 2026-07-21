/**
 * Public Deployments catalog.
 *
 * BOM sections/slots are adapted from the zrm seed
 * (`../zrm/backend/src/seed.rs` — Cluster A Phoenix sample), with pricing
 * stripped. Marketing fields (region, target date, availability) are authored
 * here for the public site.
 */

export type Category =
  | "Gpu"
  | "Network"
  | "Management"
  | "Nas"
  | "Rack"
  | "Power"
  | "Cooling"
  | "Broadband";

/** UI tabs: BOM categories plus Data Center / Simulation (not priced BOM). */
export type DeploymentTab = Category | "DataCenter" | "Simulation";

export const CATEGORY_ORDER: readonly Category[] = [
  "Gpu",
  "Network",
  "Management",
  "Nas",
  "Rack",
  "Power",
  "Cooling",
  "Broadband",
] as const;

export const TAB_ORDER: readonly DeploymentTab[] = [
  ...CATEGORY_ORDER,
  "DataCenter",
  "Simulation",
] as const;

export const TAB_LABELS: Record<DeploymentTab, string> = {
  Gpu: "GPU",
  Network: "Network",
  Management: "Management",
  Nas: "NAS",
  Rack: "Rack",
  Power: "Power",
  Cooling: "Cooling",
  Broadband: "Broadband",
  DataCenter: "Data Center",
  Simulation: "Simulation",
};

export const GROUPED_CATEGORIES: readonly Category[] = ["Network", "Broadband"];

export interface Section {
  readonly category: Category;
  readonly nodeName?: string | null;
  readonly nodeSku?: string | null;
  readonly nodeCount: number;
  readonly uHeight?: number | null;
  readonly powerKw?: number | null;
  readonly nodesPerRack?: number | null;
  readonly pduCircuits?: string | null;
  readonly electrical?: string | null;
  readonly cooling?: string | null;
}

export interface DeploymentSlot {
  readonly id: string;
  readonly category: Category;
  readonly group?: string | null;
  readonly label: string;
  readonly description?: string | null;
  readonly sku?: string | null;
  readonly manufacturer?: string | null;
  readonly oemUrl?: string | null;
  readonly quantity: number;
  readonly position: number;
}

export type Availability = "Available" | "Reserved" | "Deployed";

export interface Deployment {
  /** Stable 8-char hex hash (sha256 of slug, truncated). */
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly region: string;
  readonly targetDate: string;
  readonly availability: Availability;
  readonly sections: readonly Section[];
  readonly slots: readonly DeploymentSlot[];
}

interface SlotSeed {
  readonly category: Category;
  readonly group?: string | null;
  readonly label: string;
  readonly description?: string | null;
  readonly sku?: string | null;
  readonly manufacturer?: string | null;
  readonly oemUrl?: string | null;
  readonly quantity: number;
}

/** Shared BOM line items from zrm seed (prices omitted). */
const SLOT_SEEDS: readonly SlotSeed[] = [
  // GPU
  {
    category: "Gpu",
    label: "Chassis",
    description: "4U DP NVIDIA HGX B300 DLC",
    sku: "G4L4-ZD3-LCX7-L1001",
    manufacturer: "GIGABYTE",
    oemUrl: "https://www.gigabyte.com/Enterprise/GPU-Server/G4L4-ZD3-LAX7",
    quantity: 1,
  },
  {
    category: "Gpu",
    label: "Processor",
    description: "AMD TURIN 9555 (64C, 3.2GHz), 360W",
    sku: "AMD-9555",
    manufacturer: "AMD",
    oemUrl: "https://www.amd.com/en/products/processors/server/epyc.html",
    quantity: 2,
  },
  {
    category: "Gpu",
    label: "GPU",
    description: "NVIDIA B300 HGX GPU",
    sku: "NV-B300-HGX",
    manufacturer: "NVIDIA",
    oemUrl: "https://www.nvidia.com/en-us/data-center/hgx/",
    quantity: 8,
  },
  {
    category: "Gpu",
    label: "Memory",
    description: "128GB DDR5 RDIMM (3TB per node)",
    sku: "MEM-128-DDR5",
    manufacturer: "Micron",
    oemUrl: "https://www.micron.com/products/memory/dram-modules/rdimm",
    quantity: 24,
  },
  {
    category: "Gpu",
    label: "Boot SSD",
    description: "1.92TB M.2 NVMe SSD",
    sku: "SSD-M2-192",
    manufacturer: "Micron",
    oemUrl: "https://www.micron.com/products/storage/ssd",
    quantity: 1,
  },
  {
    category: "Gpu",
    label: "Data SSD",
    description: "3.84TB U.2 NVMe SSD",
    sku: "SSD-U2-384",
    manufacturer: "Micron",
    oemUrl: "https://www.micron.com/products/storage/ssd",
    quantity: 4,
  },
  {
    category: "Gpu",
    label: "SuperNIC",
    description: "NVIDIA ConnectX-8 SuperNIC",
    sku: "MLX-CX8",
    manufacturer: "NVIDIA",
    oemUrl:
      "https://www.nvidia.com/en-us/networking/products/ethernet/connectx-8/",
    quantity: 8,
  },
  {
    category: "Gpu",
    label: "DPU",
    description: "NVIDIA BlueField-3 B3240",
    sku: "B3240",
    manufacturer: "NVIDIA",
    oemUrl:
      "https://www.nvidia.com/en-us/networking/products/data-processing-unit/",
    quantity: 1,
  },
  {
    category: "Gpu",
    label: "TPM",
    description: "CTM012 TPM 2.0 Module",
    sku: "CTM012",
    manufacturer: "GIGABYTE",
    oemUrl: "https://www.gigabyte.com/Enterprise/GPU-Server/G4L4-ZD3-LAX7",
    quantity: 1,
  },
  {
    category: "Gpu",
    label: "PSU",
    description: "3000W 80 PLUS Titanium (5+5, included)",
    sku: "PSU-3000T",
    manufacturer: "GIGABYTE",
    oemUrl: "https://www.gigabyte.com/Enterprise/GPU-Server/G4L4-ZD3-LAX7",
    quantity: 10,
  },
  {
    category: "Gpu",
    label: "Redundancy",
    description:
      "5+5 PSU redundancy, dual A/B power cords, dual-rail SuperNICs",
    quantity: 1,
  },
  {
    category: "Gpu",
    label: "Cooling type",
    description: "Direct Liquid Cooling",
    quantity: 1,
  },
  {
    category: "Gpu",
    label: "OS",
    description: "Ubuntu 22.04 LTS",
    oemUrl: "https://ubuntu.com/download/server",
    quantity: 1,
  },
  {
    category: "Gpu",
    label: "Assembly",
    description: "Assembly",
    quantity: 1,
  },
  {
    category: "Gpu",
    label: "Shipping",
    description: "Shipping",
    quantity: 1,
  },

  // Management
  {
    category: "Management",
    label: "Chassis",
    description: "R183-ZF1 1U 2S general purpose",
    sku: "R183-ZF1-ACJ1",
    manufacturer: "GIGABYTE",
    oemUrl:
      "https://www.gigabyte.com/Enterprise/Rack-Server/R183-ZF1-AAJ1-rev-3x",
    quantity: 1,
  },
  {
    category: "Management",
    label: "Processor",
    description: "AMD EPYC 9135 16-Core",
    sku: "EPYC-9135",
    manufacturer: "AMD",
    oemUrl: "https://www.amd.com/en/products/processors/server/epyc.html",
    quantity: 2,
  },
  {
    category: "Management",
    label: "Memory",
    description: "32GB DDR5 RDIMM 6400MHz (128GB total)",
    sku: "MEM-32-DDR5-6400",
    manufacturer: "Micron",
    oemUrl: "https://www.micron.com/products/memory/dram-modules/rdimm",
    quantity: 4,
  },
  {
    category: "Management",
    label: "Boot SSD",
    description: "960GB NVMe SSD (OS)",
    sku: "SSD-960-NVME",
    manufacturer: "Micron",
    oemUrl: "https://www.micron.com/products/storage/ssd",
    quantity: 1,
  },
  {
    category: "Management",
    label: "DPU",
    description: "BF3 (BlueField-3) - 1x slot",
    sku: "BF3",
    manufacturer: "NVIDIA",
    oemUrl:
      "https://www.nvidia.com/en-us/networking/products/data-processing-unit/",
    quantity: 1,
  },
  {
    category: "Management",
    label: "PSU",
    description: "Redundant PSU (1+1)",
    sku: "PSU-CRPS",
    manufacturer: "GIGABYTE",
    oemUrl:
      "https://www.gigabyte.com/Enterprise/Rack-Server/R183-ZF1-AAJ1-rev-3x",
    quantity: 2,
  },
  {
    category: "Management",
    label: "Redundancy",
    description: "1+1 PSU redundancy, dual A/B power cords",
    quantity: 1,
  },
  {
    category: "Management",
    label: "OS",
    description: "Ubuntu 22.04 LTS",
    oemUrl: "https://ubuntu.com/download/server",
    quantity: 1,
  },
  {
    category: "Management",
    label: "Assembly",
    description: "Assembly",
    quantity: 1,
  },
  {
    category: "Management",
    label: "Shipping",
    description: "Shipping",
    quantity: 1,
  },

  // Network
  {
    category: "Network",
    group: "WAN/Core + FW",
    label: "Router/Firewall (HA pair)",
    description: "Juniper MX304 + SRX - redundant HA pair",
    sku: "MX304",
    manufacturer: "Juniper",
    oemUrl: "https://www.juniper.net/us/en/products/routers/mx-series.html",
    quantity: 2,
  },
  {
    category: "Network",
    group: "Spine/Core",
    label: "Switch (redundant pair)",
    description: "Arista 7808R3 800G - redundant spine pair (N+1)",
    sku: "DCS-7808R3",
    manufacturer: "Arista",
    oemUrl: "https://www.arista.com/en/products/7800r3-series",
    quantity: 2,
  },
  {
    category: "Network",
    group: "Leaf (TOR)",
    label: "ToR Switch A (primary)",
    description: "Arista 7060X6 - primary ToR",
    sku: "DCS-7060X6",
    manufacturer: "Arista",
    oemUrl: "https://www.arista.com/en/products/7060x-series",
    quantity: 8,
  },
  {
    category: "Network",
    group: "Leaf (TOR)",
    label: "ToR Switch B (redundant, N+1)",
    description: "Arista 7060X6 - redundant ToR, dual-homed",
    sku: "DCS-7060X6",
    manufacturer: "Arista",
    oemUrl: "https://www.arista.com/en/products/7060x-series",
    quantity: 8,
  },
  {
    category: "Network",
    group: "GPU fabric",
    label: "IB Switch A (primary)",
    description: "NVIDIA Quantum-X800 800G InfiniBand",
    sku: "Q-X800",
    manufacturer: "NVIDIA",
    oemUrl: "https://www.nvidia.com/en-us/networking/infiniband-switching/",
    quantity: 16,
  },
  {
    category: "Network",
    group: "GPU fabric",
    label: "IB Switch B (redundant, N+1)",
    description: "NVIDIA Quantum-X800 800G IB - dual-rail failover",
    sku: "Q-X800",
    manufacturer: "NVIDIA",
    oemUrl: "https://www.nvidia.com/en-us/networking/infiniband-switching/",
    quantity: 16,
  },
  {
    category: "Network",
    group: "Optics",
    label: "800G OSFP transceiver",
    description: "NVIDIA 800G OSFP (sized for A/B fabric)",
    sku: "MMA4Z00",
    manufacturer: "NVIDIA",
    oemUrl: "https://www.nvidia.com/en-us/networking/optics/",
    quantity: 1024,
  },
  {
    category: "Network",
    group: "Cabling",
    label: "MPO/APC fiber trunks",
    description: "MPO/APC fiber trunks (A/B fabric)",
    sku: "FIBER-MPO",
    quantity: 1600,
  },
  {
    category: "Network",
    group: "GPU fabric",
    label: "Redundancy",
    description: "N+1: dual-rail to A/B switches, ISL, adaptive routing",
    quantity: 1,
  },
  {
    category: "Network",
    group: "Spine/Core",
    label: "Redundancy",
    description: "2N power, MLAG uplink, ECMP",
    quantity: 1,
  },
  {
    category: "Network",
    group: "Leaf (TOR)",
    label: "Link aggregation",
    description: "LACP / MLAG dual-homed A/B",
    quantity: 1,
  },

  // Rack
  {
    category: "Rack",
    label: "Rack cabinet",
    description: "48U 750mm DLC-ready",
    sku: "VR3350",
    manufacturer: "Vertiv",
    oemUrl: "https://www.vertiv.com/en-us/products-catalog/racks-enclosures/",
    quantity: 16,
  },
  {
    category: "Rack",
    label: "Rack PDU (A/B)",
    description:
      "Geist VP7N6013 switched rPDU, 60A 240/415V WYE, 0U - dual A/B feeds (N+N)",
    sku: "VP7N6013",
    manufacturer: "Vertiv",
    oemUrl:
      "https://www.neobits.com/vertiv_vp7n6013_vertiv_geist_vp7n6013_rpdu__p25546043.html",
    quantity: 32,
  },
  {
    category: "Rack",
    label: "Blanking/rails",
    description: "Rails, blanking, cable mgmt",
    sku: "RACK-KIT",
    manufacturer: "Vertiv",
    oemUrl: "https://www.vertiv.com/en-us/products-catalog/racks-enclosures/",
    quantity: 16,
  },
  {
    category: "Rack",
    label: "Redundancy",
    description:
      "Dual A/B rPDU feeds per rack (N+N); each server cords to both",
    quantity: 1,
  },

  // Power
  {
    category: "Power",
    label: "Padmount transformer (A/B)",
    description:
      "2550 kVA 3-phase padmount, 14400 GY/8320 to 480 Y/277 - redundant A/B feeds (N+N)",
    sku: "2550KVA-14400-480",
    manufacturer: "Giga Energy",
    oemUrl:
      "https://www.gigaenergy.com/shop/2550-kva-3-phase-padmount-transformer-14400-gy-8320-to-480-y-277",
    quantity: 2,
  },
  {
    category: "Power",
    label: "ATS / transfer switch",
    description: "Automatic transfer switch for N+N utility feed failover",
    sku: "ATS-3P",
    manufacturer: "ASCO",
    oemUrl:
      "https://www.asco.com/en-us/Pages/automatic-transfer-switches.aspx",
    quantity: 1,
  },
  {
    category: "Power",
    label: "Redundancy",
    description:
      "N+N: dual A/B utility feeds, ATS failover, UPS + generator backup",
    quantity: 1,
  },

  // Cooling
  {
    category: "Cooling",
    label: "CDU (active)",
    description:
      "1.3MW liquid-to-liquid CDU - N+1 redundant hot-swap pumps/PSUs",
    sku: "MCDU-1300",
    manufacturer: "Motivair",
    oemUrl:
      "https://www.motivaircorp.com/products/coolant-distribution-units/",
    quantity: 4,
  },
  {
    category: "Cooling",
    label: "CDU (N+1 spare)",
    description: "1.3MW liquid-to-liquid CDU - redundant standby unit",
    sku: "MCDU-1300",
    manufacturer: "Motivair",
    oemUrl:
      "https://www.motivaircorp.com/products/coolant-distribution-units/",
    quantity: 1,
  },
  {
    category: "Cooling",
    label: "Manifolds + QDs",
    description: "Supply/return manifolds, dripless QDs (dual-fed)",
    sku: "MAN-KIT",
    manufacturer: "Motivair",
    oemUrl: "https://www.motivaircorp.com/products/",
    quantity: 16,
  },
  {
    category: "Cooling",
    label: "Leak detection",
    description: "Rope + zone controller",
    sku: "LD-SYS",
    manufacturer: "RLE",
    oemUrl: "https://www.rletech.com/product-category/leak-detection/",
    quantity: 1,
  },
  {
    category: "Cooling",
    label: "Redundancy",
    description: "N+1 CDU, redundant pumps/PSUs, dual supply/return loops",
    quantity: 1,
  },

  // Broadband
  {
    category: "Broadband",
    group: "Lumen (AS3356)",
    label: "Transit or Peering",
    description: "Transit",
    oemUrl: "https://www.lumen.com/en-us/networking/internet.html",
    quantity: 1,
  },
  {
    category: "Broadband",
    group: "Lumen (AS3356)",
    label: "Network Tier",
    description: "Tier 1",
    quantity: 1,
  },
  {
    category: "Broadband",
    group: "Lumen (AS3356)",
    label: "Capacity",
    description: "2 x 100G",
    quantity: 1,
  },
  {
    category: "Broadband",
    group: "Lumen (AS3356)",
    label: "Performance SLA",
    description: "< 40ms US",
    quantity: 1,
  },
  {
    category: "Broadband",
    group: "Lumen (AS3356)",
    label: "Availability SLA",
    description: "99.99%",
    quantity: 1,
  },
  {
    category: "Broadband",
    group: "Lumen (AS3356)",
    label: "Active or backup",
    description: "Active",
    quantity: 1,
  },
  {
    category: "Broadband",
    group: "Lumen (AS3356)",
    label: "Upstream DDoS",
    description: "Yes (Lumen DDoS)",
    quantity: 1,
  },
  {
    category: "Broadband",
    group: "Lumen (AS3356)",
    label: "Metrics file",
    description:
      "Previous two quarters of latency/utilization/throughput/packet-loss",
    quantity: 1,
  },
];

function buildSections(gpuNodeCount: number): Section[] {
  return [
    {
      category: "Gpu",
      nodeName: "4U DP NVIDIA HGX B300 DLC",
      nodeSku: "G4L4-ZD3-LCX7-L1001",
      nodeCount: gpuNodeCount,
      uHeight: 4,
      powerKw: 90,
      nodesPerRack: 1,
      pduCircuits: "9 + 3",
      electrical: "6 x 63A",
      cooling: "In-Row",
    },
    { category: "Network", nodeCount: 1 },
    {
      category: "Management",
      nodeName: "R183-ZF1-ACJ1 1U/2S General Purpose server",
      nodeSku: "R183-ZF1-ACJ1",
      nodeCount: 6,
      uHeight: 1,
    },
    { category: "Nas", nodeCount: 1 },
    { category: "Rack", nodeCount: 1 },
    { category: "Power", nodeCount: 1 },
    { category: "Cooling", nodeCount: 1 },
    { category: "Broadband", nodeCount: 1 },
  ];
}

function buildSlots(deploymentId: string): DeploymentSlot[] {
  return SLOT_SEEDS.map((seed, index) => ({
    id: `${deploymentId}-s${String(index + 1).padStart(2, "0")}`,
    category: seed.category,
    group: seed.group ?? null,
    label: seed.label,
    description: seed.description ?? null,
    sku: seed.sku ?? null,
    manufacturer: seed.manufacturer ?? null,
    oemUrl: seed.oemUrl ?? null,
    quantity: seed.quantity,
    position: index + 1,
  }));
}

function makeDeployment(input: {
  id: string;
  slug: string;
  name: string;
  region: string;
  targetDate: string;
  availability: Availability;
  gpuNodeCount: number;
}): Deployment {
  return {
    id: input.id,
    slug: input.slug,
    name: input.name,
    region: input.region,
    targetDate: input.targetDate,
    availability: input.availability,
    sections: buildSections(input.gpuNodeCount),
    slots: buildSlots(input.id),
  };
}

export const DEPLOYMENTS: readonly Deployment[] = [
  makeDeployment({
    id: "bcf53f23",
    slug: "32-node-b300-ontario",
    name: "32 NODE B300",
    region: "Ontario, Canada",
    targetDate: "October 19, 2026",
    availability: "Available",
    gpuNodeCount: 32,
  }),
  makeDeployment({
    id: "654cd616",
    slug: "128-node-b300-columbus",
    name: "128 NODE B300",
    region: "Columbus, Ohio",
    targetDate: "November 24, 2026",
    availability: "Available",
    gpuNodeCount: 128,
  }),
  makeDeployment({
    id: "b858784f",
    slug: "128-node-b300-santa-clara",
    name: "128 NODE B300",
    region: "Santa Clara, California",
    targetDate: "January 24, 2026",
    availability: "Available",
    gpuNodeCount: 128,
  }),
] as const;

export function getDeploymentById(id: string): Deployment | undefined {
  return DEPLOYMENTS.find((d) => d.id === id);
}

export function parseDeploymentTab(
  value: string | null | undefined,
): DeploymentTab {
  if (value == null) return "Gpu";
  const normalized = value.trim();
  const byKey = TAB_ORDER.find(
    (tab) => tab.toLowerCase() === normalized.toLowerCase(),
  );
  if (byKey) return byKey;
  const byLabel = TAB_ORDER.find(
    (tab) =>
      TAB_LABELS[tab].toLowerCase().replace(/\s+/g, "-") ===
      normalized.toLowerCase(),
  );
  return byLabel ?? "Gpu";
}

export function isCategory(tab: DeploymentTab): tab is Category {
  return (CATEGORY_ORDER as readonly string[]).includes(tab);
}

export function sectionPowerMeta(section: Section): string | null {
  const parts: string[] = [];
  if (section.uHeight != null) parts.push(`${section.uHeight}U`);
  if (section.powerKw != null) {
    parts.push(
      `${section.powerKw.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })} kW/node`,
    );
  }
  if (section.powerKw != null && section.nodesPerRack != null) {
    parts.push(
      `${(section.powerKw * section.nodesPerRack).toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })} kW/rack`,
    );
  }
  if (section.pduCircuits) parts.push(section.pduCircuits);
  if (section.electrical) parts.push(section.electrical);
  if (section.cooling) parts.push(section.cooling);
  return parts.length ? parts.join(" · ") : null;
}

export function slotsForCategory(
  deployment: Deployment,
  category: Category,
): DeploymentSlot[] {
  return deployment.slots
    .filter((s) => s.category === category)
    .slice()
    .sort((a, b) => a.position - b.position);
}
