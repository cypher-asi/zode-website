import { switchOptics } from "./build";
import { FABRICS, PDUS_PER_RACK, PLATFORMS, SUPPORT, UFM_HCAS } from "./catalog";
import type { ClusterModel, PartKind } from "./types";

/*
 * Everything a cluster needs to run, as slots a deployment's bill of
 * materials fills with quoted lines (src/features/deployments/bom). Each slot
 * works out how many it needs from the built cluster, so a change to the
 * configuration shows straight away what the BOM is short of. Slot ids are
 * stored with the BOM: renaming one means migrating deployment_bom_fills.
 */

export type SlotSection =
  | "compute"
  | "fabric"
  | "network"
  | "security"
  | "storage"
  | "management"
  | "rack"
  | "services";

export const SLOT_SECTIONS: readonly { id: SlotSection; label: string }[] = [
  { id: "compute", label: "Compute nodes" },
  { id: "fabric", label: "GPU fabric" },
  { id: "network", label: "Front-end, storage and out-of-band network" },
  { id: "security", label: "Edge and security" },
  { id: "storage", label: "Storage" },
  { id: "management", label: "Management and software" },
  { id: "rack", label: "Racks, power and cooling" },
  { id: "services", label: "Services, freight and spares" },
];

export interface Slot {
  id: string;
  section: SlotSection;
  label: string;
  /** "lot" slots are one-off scopes (services, freight, a software estate) any filling line covers. */
  unit: "each" | "lot";
  /** Worth quoting but a cluster runs without it. */
  optional?: boolean;
  /** The parts in the 3D view this slot stands for. */
  kinds?: readonly PartKind[];
  /** How many one cluster of `model` needs; 0 leaves the slot out. */
  qty: (model: ClusterModel, count: (kind: PartKind) => number) => number;
}

const lot = () => 1;

export const SLOTS: readonly Slot[] = [
  // Compute
  { id: "gpu_node", section: "compute", label: "GPU node", unit: "each", kinds: ["gpu"], qty: (m) => m.stats.nodes },
  { id: "gpu_baseboard", section: "compute", label: "HGX GPU baseboard", unit: "each", kinds: ["gpu"], qty: (m) => m.stats.nodes },
  { id: "node_cpu", section: "compute", label: "Node CPUs", unit: "each", qty: (m) => m.stats.nodes * bill(m).cpus },
  { id: "node_memory", section: "compute", label: "Node memory DIMMs", unit: "each", qty: (m) => m.stats.nodes * bill(m).dimms },
  { id: "node_boot_drive", section: "compute", label: "Node boot drives", unit: "each", qty: (m) => m.stats.nodes * bill(m).bootDrives },
  { id: "node_nvme", section: "compute", label: "Node local NVMe", unit: "each", qty: (m) => m.stats.nodes * bill(m).dataDrives },
  {
    id: "node_frontend_nic",
    section: "compute",
    label: "Front-end DPUs",
    unit: "each",
    qty: (m) => m.stats.nodes * bill(m).frontEndNics,
  },
  { id: "node_power_cord", section: "compute", label: "Node power cords", unit: "each", qty: (m) => m.stats.nodes * bill(m).powerCords },
  {
    id: "node_integration",
    section: "compute",
    label: "Node assembly and liquid-cooling integration",
    unit: "each",
    qty: (m) => m.stats.nodes,
  },
  { id: "node_warranty", section: "compute", label: "Node warranty", unit: "each", qty: (m) => m.stats.nodes },

  // GPU fabric
  {
    id: "fabric_switch",
    section: "fabric",
    label: "Fabric switches, leaf and spine",
    unit: "each",
    kinds: ["leaf", "spine"],
    qty: (m) => m.stats.leaves + m.stats.spines,
  },
  {
    id: "fabric_switch_power_cord",
    section: "fabric",
    label: "Fabric switch power cords",
    unit: "each",
    qty: (m) => (m.stats.leaves + m.stats.spines) * FABRICS[m.config.fabric].compute.psus,
  },
  {
    id: "fabric_switch_support",
    section: "fabric",
    label: "Fabric switch support",
    unit: "each",
    qty: (m) => m.stats.leaves + m.stats.spines,
  },
  { id: "node_transceiver", section: "fabric", label: "Node-side transceivers", unit: "each", qty: (m) => m.stats.hostLinks },
  {
    id: "switch_transceiver",
    section: "fabric",
    label: "Switch-side twin-port transceivers",
    unit: "each",
    qty: (m) => switchOptics(m.stats.hostLinks, m.stats.uplinks),
  },
  {
    id: "fabric_fiber",
    section: "fabric",
    label: "Fabric fiber, rail and uplink",
    unit: "each",
    qty: (m) => m.stats.hostLinks + m.stats.uplinks,
  },
  { id: "fabric_manager", section: "fabric", label: "Fabric manager appliances", unit: "each", kinds: ["ufm"], qty: (_, n) => n("ufm") },
  {
    id: "fabric_manager_license",
    section: "fabric",
    label: "Fabric manager licenses",
    unit: "each",
    qty: (m, n) => (n("ufm") ? m.stats.gpus + n("ufm") * UFM_HCAS : 0),
  },

  // Front-end, storage and out-of-band
  {
    id: "storage_switch",
    section: "network",
    label: "Front-end and storage switches",
    unit: "each",
    kinds: ["storageSwitch"],
    qty: (_, n) => n("storageSwitch"),
  },
  {
    id: "storage_switch_power_cord",
    section: "network",
    label: "Front-end switch power cords",
    unit: "each",
    qty: (_, n) => n("storageSwitch") * SUPPORT.storageSwitch.psus,
  },
  { id: "storage_switch_support", section: "network", label: "Front-end switch support", unit: "each", qty: (_, n) => n("storageSwitch") },
  { id: "frontend_optics", section: "network", label: "Front-end optics and fiber", unit: "lot", qty: lot },
  { id: "oob_switch", section: "network", label: "Out-of-band switches", unit: "each", kinds: ["oob"], qty: (_, n) => n("oob") },
  { id: "oob_switch_support", section: "network", label: "Out-of-band switch support", unit: "each", qty: (_, n) => n("oob") },
  { id: "console_server", section: "network", label: "Serial console server", unit: "each", qty: lot },
  {
    id: "switch_monitoring_license",
    section: "network",
    label: "Ethernet switch monitoring licenses",
    unit: "each",
    optional: true,
    qty: (m, n) => n("storageSwitch") + n("edge") + n("oob") + (m.config.fabric === "roce" ? m.stats.leaves + m.stats.spines : 0),
  },

  // Edge and security
  { id: "edge_router", section: "security", label: "Edge routers or border leaves", unit: "each", kinds: ["edge"], qty: (_, n) => n("edge") },
  { id: "edge_support", section: "security", label: "Edge support", unit: "each", qty: (_, n) => n("edge") },
  { id: "firewall", section: "security", label: "Firewalls", unit: "each", kinds: ["firewall"], qty: (_, n) => n("firewall") },
  { id: "firewall_support", section: "security", label: "Firewall support", unit: "each", qty: (_, n) => n("firewall") },
  { id: "wan_optics", section: "security", label: "WAN and firewall optics", unit: "lot", qty: lot },

  // Storage
  { id: "storage_node", section: "storage", label: "Storage nodes", unit: "each", kinds: ["nas"], qty: (_, n) => n("nas") },
  { id: "storage_software", section: "storage", label: "Storage software", unit: "lot", qty: (_, n) => (n("nas") ? 1 : 0) },
  { id: "storage_install", section: "storage", label: "Storage installation", unit: "lot", qty: (_, n) => (n("nas") ? 1 : 0) },

  // Management and software
  { id: "mgmt_server", section: "management", label: "Management servers", unit: "each", kinds: ["mgmt"], qty: (_, n) => n("mgmt") },
  {
    id: "server_support",
    section: "management",
    label: "Management and fabric manager server support",
    unit: "each",
    qty: (_, n) => n("mgmt") + n("ufm"),
  },
  {
    id: "cluster_software",
    section: "management",
    label: "Cluster management software",
    unit: "lot",
    optional: true,
    qty: lot,
  },

  // Racks, power and cooling
  { id: "cabinet", section: "rack", label: "Cabinets", unit: "each", qty: (m) => m.stats.racks },
  {
    id: "rack_pdu",
    section: "rack",
    label: "Rack PDUs",
    unit: "each",
    qty: (m) => m.stats.computeRacks * PDUS_PER_RACK.compute + m.stats.networkRacks * PDUS_PER_RACK.network,
  },
  { id: "manifold", section: "rack", label: "Coolant manifolds", unit: "each", kinds: ["manifold"], qty: (_, n) => n("manifold") },
  { id: "cdu", section: "rack", label: "In-rack CDUs", unit: "each", qty: (m) => m.stats.computeRacks },
  { id: "leak_detection", section: "rack", label: "Leak detection", unit: "each", qty: (m) => m.stats.computeRacks },
  { id: "patch_panel", section: "rack", label: "Fiber patch panels", unit: "each", kinds: ["panel"], qty: (_, n) => n("panel") },
  { id: "rack_integration", section: "rack", label: "Rack and stack", unit: "each", qty: (m) => m.stats.computeRacks },
  { id: "rack_warranty", section: "rack", label: "Rack and CDU warranty", unit: "lot", qty: lot },

  // Services
  { id: "integration_services", section: "services", label: "Integration and field engineering", unit: "lot", qty: lot },
  { id: "configuration_services", section: "services", label: "Configuration and bring-up", unit: "lot", qty: lot },
  { id: "freight", section: "services", label: "Freight", unit: "lot", qty: lot },
  { id: "spares", section: "services", label: "Spares", unit: "lot", optional: true, qty: lot },
];

function bill(model: ClusterModel) {
  return PLATFORMS[model.config.platform].bill;
}

const BY_ID = new Map(SLOTS.map((slot) => [slot.id, slot]));

export const slotById = (id: string): Slot | undefined => BY_ID.get(id);
export const isSlotId = (id: string): boolean => BY_ID.has(id);

/** Every slot one cluster of `model` needs, `copies` times over, in section order. */
export function requiredSlots(model: ClusterModel, copies = 1): { slot: Slot; qty: number }[] {
  const counts = new Map<PartKind, number>();
  for (const rack of model.racks) for (const part of rack.parts) counts.set(part.kind, (counts.get(part.kind) ?? 0) + 1);
  const count = (kind: PartKind) => counts.get(kind) ?? 0;
  const order = new Map(SLOT_SECTIONS.map((s, i) => [s.id, i]));
  return SLOTS.map((slot) => ({ slot, qty: slot.qty(model, count) }))
    .filter((row) => row.qty > 0)
    .map((row) => ({ slot: row.slot, qty: row.slot.unit === "lot" ? 1 : row.qty * copies }))
    .sort((a, b) => order.get(a.slot.section)! - order.get(b.slot.section)!);
}
