import { switchOptics } from "@/features/cluster/model/build";
import { FABRICS, PDUS_PER_RACK, PLATFORMS, SUPPORT, UFM_HCAS } from "@/features/cluster/model/catalog";
import type { PartKind, PlatformId } from "@/features/cluster/model/types";
import { STORAGE_PLATFORMS, SYSTEMS, valueLabel, type ResolvedConfig } from "../config/catalog";
import type { Sizing } from "./sizing";

/*
 * Everything a phase needs to run, as slots its bill of materials fills with
 * lines picked from the deployment's quotes. The phase's configuration
 * decides which slots it has, how many each needs (from its `Sizing`) and
 * what to quote for each, so a change to the configuration shows straight
 * away what the BOM is short of. Slot ids are stored with the BOM: renaming
 * one means migrating deployment_bom_lines.
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
  /** Its label under configuration `c`, when that changes what it stands for. */
  labelFor?: (c: ResolvedConfig) => string;
  /** "lot" slots are one-off scopes (services, freight, a software estate) any filling line covers. */
  unit: "each" | "lot";
  /** Worth quoting but a cluster runs without it. */
  optional?: boolean;
  /** The parts in the 3D view this slot stands for. */
  kinds?: readonly PartKind[];
  /** How many the phase needs; 0 leaves the slot out. A lot needs 1. */
  qty: (s: Sizing, c: ResolvedConfig) => number;
  /** What to quote for it. */
  spec?: (c: ResolvedConfig, s: Sizing) => string | null;
}

const lot = () => 1;
const when = (on: boolean, value: number) => (on ? value : 0);

const hgx = (c: ResolvedConfig) => !SYSTEMS[c.platform].rackScale;
const bill = (c: ResolvedConfig) => (hgx(c) ? PLATFORMS[c.platform as PlatformId].bill : null);
const liquid = (c: ResolvedConfig) => c.cooling === "liquid_dtc";
const rail = (c: ResolvedConfig) => `${SYSTEMS[c.platform].railGbps}G`;
const count = (n: number) => n.toLocaleString("en-US");

const SUPPORT_LEVEL: Record<ResolvedConfig["supportLevel"], string> = {
  parts: "parts only, return to vendor",
  nbd: "next-business-day on-site",
  "4hr": "4-hour on-site",
};
const support = (c: ResolvedConfig) => `${c.supportYears}-year ${SUPPORT_LEVEL[c.supportLevel]}`;
const term = (c: ResolvedConfig) => `${c.supportYears}-year term`;

const opticsSource = (c: ResolvedConfig) => (c.opticsSource === "oem" ? "NVIDIA" : "third party, NVIDIA compatible");
const singleMode = (c: ResolvedConfig) => c.optics !== "sr";
const fiberType = (c: ResolvedConfig) => (singleMode(c) ? "MPO-12 APC, OS2 single-mode" : "MPO-12 APC, OM4 multimode");

const PLUGGABLE: Record<Exclude<ResolvedConfig["optics"], "aoc">, string> = {
  dr4: "DR4, 1310 nm single-mode, 500 m",
  sr: "SR, 850 nm multimode, 50 m",
  lpo: "linear pluggable (LPO), DR4 single-mode",
  cpo: "DR4, 1310 nm single-mode, 500 m",
};
const pluggable = (c: ResolvedConfig) => (c.optics === "aoc" ? "" : PLUGGABLE[c.optics]);

/** Fabric links, rails and uplinks. */
const links = (s: Sizing) => s.hostLinks + s.uplinks;
const nodeTransceivers = (s: Sizing, c: ResolvedConfig) => when(c.optics !== "aoc", s.hostLinks);
const switchTransceivers = (s: Sizing, c: ResolvedConfig) =>
  when(c.optics !== "aoc" && c.optics !== "cpo", switchOptics(s.hostLinks, s.uplinks));
const aocs = (s: Sizing, c: ResolvedConfig) => when(c.optics === "aoc", links(s));
const fabricSwitches = (s: Sizing) => s.leaves + s.spines;
const frontEndSwitches = (s: Sizing) => s.storageSwitches + s.storageFabricSwitches;
const frontEndNics = (s: Sizing, c: ResolvedConfig) => s.nodes * (bill(c)?.frontEndNics ?? 1);

/** External laser source modules on one co-packaged optics switch. PLACEHOLDER. */
const CPO_LASERS_PER_SWITCH = 18;
/** Fabric links one structured trunk carries: 144 fibers as 12 MPO-12s. */
const LINKS_PER_TRUNK = 12;
/** What one in-row CDU cools. PLACEHOLDER. */
const IN_ROW_CDU_KW = 1200;

const FRONT_END_NIC: Record<ResolvedConfig["frontEndNic"], string> = {
  b3220: "NVIDIA BlueField-3 B3220, 2 x 200GbE, crypto disabled",
  b3240: "NVIDIA BlueField-3 B3240, 2 x 400GbE",
  cx7: "NVIDIA ConnectX-7, 2 x 200GbE",
};

const WAN_GBPS: Record<ResolvedConfig["wan"], number> = { "2x100": 200, "4x100": 400, "2x400": 800 };

const ORCHESTRATION: Record<ResolvedConfig["orchestration"], string> = {
  customer: "",
  slurm: "Slurm workload manager, with support",
  kubernetes: "Kubernetes with the NVIDIA GPU and network operators",
  bcm: "NVIDIA Base Command Manager licenses",
};

const PDU: Record<ResolvedConfig["pdu"], string> = {
  "208v_60a": "Switched, outlet-metered, 208V 3-phase 60A",
  "415v_32a": "Switched, outlet-metered, 415V 3-phase 32A",
  "415v_60a": "Switched, outlet-metered, 415V 3-phase 60A",
};
const pdusPerRack = (c: ResolvedConfig, kind: "compute" | "network") =>
  c.power === "2n" ? PDUS_PER_RACK[kind] : PDUS_PER_RACK[kind] / 2;

const spares = (c: ResolvedConfig, n: number) => (c.sparesPct ? Math.ceil((n * c.sparesPct) / 100) : 0);

export const SLOTS: readonly Slot[] = [
  // Compute
  {
    id: "gpu_node",
    section: "compute",
    label: "GPU node",
    labelFor: (c) => (hgx(c) ? "GPU nodes" : "Compute trays"),
    unit: "each",
    kinds: ["gpu"],
    qty: (s) => s.nodes,
    spec: (c) => `${SYSTEMS[c.platform].label}: ${SYSTEMS[c.platform].detail}`,
  },
  {
    id: "nvl_rack",
    section: "compute",
    label: "Rack-scale systems",
    unit: "each",
    qty: (s) => s.systemRacks,
    spec: (c) =>
      `${SYSTEMS[c.platform].label} rack: ${SYSTEMS[c.platform].nodesPerRack} compute trays, NVLink spine, busbar and manifolds`,
  },
  {
    id: "nvlink_switch_tray",
    section: "compute",
    label: "NVLink switch trays",
    unit: "each",
    qty: (s, c) => s.systemRacks * SYSTEMS[c.platform].switchTrays,
    spec: (c) => `${SYSTEMS[c.platform].switchTrays} per rack`,
  },
  {
    id: "power_shelf",
    section: "compute",
    label: "Power shelves",
    unit: "each",
    qty: (s, c) => s.systemRacks * SYSTEMS[c.platform].powerShelves,
    spec: (c) => `${SYSTEMS[c.platform].powerShelves} per rack, ${c.power === "2n" ? "N+N" : "N+1"} power supplies`,
  },
  {
    id: "gpu_baseboard",
    section: "compute",
    label: "HGX GPU baseboard",
    unit: "each",
    kinds: ["gpu"],
    qty: (s, c) => when(hgx(c), s.nodes),
    spec: (c) => `${SYSTEMS[c.platform].label} 8-GPU baseboard`,
  },
  {
    id: "node_cpu",
    section: "compute",
    label: "Node CPUs",
    unit: "each",
    qty: (s, c) => s.nodes * (bill(c)?.cpus ?? 0),
    spec: (c) => (c.cpu === "xeon6" ? "Intel Xeon 6, 2 per node" : "AMD EPYC 9005, 2 per node"),
  },
  {
    id: "node_memory",
    section: "compute",
    label: "Node memory DIMMs",
    unit: "each",
    qty: (s, c) => s.nodes * (bill(c)?.dimms ?? 0),
    spec: (c) => {
      const dimms = bill(c)?.dimms ?? 32;
      return `${c.memoryTb} TB per node: ${dimms} x ${Math.round((c.memoryTb * 1024) / dimms)} GB DDR5 RDIMM`;
    },
  },
  {
    id: "node_boot_drive",
    section: "compute",
    label: "Node boot drives",
    unit: "each",
    qty: (s, c) => s.nodes * (bill(c)?.bootDrives ?? 1),
    spec: (c) => (hgx(c) ? "960 GB NVMe, mirrored" : "960 GB NVMe M.2"),
  },
  {
    id: "node_nvme",
    section: "compute",
    label: "Node local NVMe",
    unit: "each",
    qty: (s, c) => s.nodes * c.nvmeDrives,
    spec: (c) => `${c.nvmeDrives} x ${c.nvmeDriveTb} TB PCIe 5.0 NVMe per node`,
  },
  {
    id: "node_frontend_nic",
    section: "compute",
    label: "Front-end DPUs",
    unit: "each",
    qty: frontEndNics,
    spec: (c) => FRONT_END_NIC[c.frontEndNic],
  },
  {
    id: "node_power_cord",
    section: "compute",
    label: "Node power cords",
    unit: "each",
    qty: (s, c) => s.nodes * (bill(c)?.powerCords ?? 0),
    spec: (c) => (c.pdu === "208v_60a" ? "C19 to C20, 16A" : "C19 to C20, 16A, for 415V PDUs"),
  },
  {
    id: "node_integration",
    section: "compute",
    label: "Node assembly and liquid-cooling integration",
    labelFor: (c) => (liquid(c) ? "Node assembly and liquid-cooling integration" : "Node assembly and integration"),
    unit: "each",
    qty: (s, c) => when(hgx(c), s.nodes),
  },
  {
    id: "node_warranty",
    section: "compute",
    label: "Node warranty",
    labelFor: (c) => (hgx(c) ? "Node warranty" : "Rack-scale system warranty"),
    unit: "each",
    qty: (s, c) => (hgx(c) ? s.nodes : s.systemRacks),
    spec: support,
  },

  // GPU fabric
  {
    id: "fabric_switch",
    section: "fabric",
    label: "Fabric switches, leaf and spine",
    unit: "each",
    kinds: ["leaf", "spine"],
    qty: fabricSwitches,
    spec: (c, s) =>
      `${FABRICS[c.networking].compute.model}${c.optics === "cpo" ? " with co-packaged optics" : ""}, ${count(s.leaves)} leaf and ${count(s.spines)} spine, ${c.oversubscription === 1 ? "non-blocking" : `${c.oversubscription}:1`}`,
  },
  {
    id: "fabric_switch_power_cord",
    section: "fabric",
    label: "Fabric switch power cords",
    unit: "each",
    qty: (s, c) => fabricSwitches(s) * FABRICS[c.networking].compute.psus,
    spec: (c) => `${FABRICS[c.networking].compute.psus} per switch`,
  },
  {
    id: "fabric_switch_support",
    section: "fabric",
    label: "Fabric switch support",
    unit: "each",
    qty: fabricSwitches,
    spec: support,
  },
  {
    id: "node_transceiver",
    section: "fabric",
    label: "Node-side transceivers",
    unit: "each",
    qty: nodeTransceivers,
    spec: (c) => `${rail(c)} OSFP single-port, ${pluggable(c)}, flat top · ${opticsSource(c)}`,
  },
  {
    id: "switch_transceiver",
    section: "fabric",
    label: "Switch-side twin-port transceivers",
    unit: "each",
    qty: switchTransceivers,
    spec: (c) => `2 x ${rail(c)} twin-port OSFP, ${pluggable(c)}, finned · ${opticsSource(c)}`,
  },
  {
    id: "cpo_laser",
    section: "fabric",
    label: "CPO external laser sources",
    unit: "each",
    qty: (s, c) => when(c.optics === "cpo", fabricSwitches(s) * CPO_LASERS_PER_SWITCH),
    spec: () => `${CPO_LASERS_PER_SWITCH} per co-packaged optics switch`,
  },
  {
    id: "fabric_aoc",
    section: "fabric",
    label: "Fabric active optical cables",
    unit: "each",
    qty: aocs,
    spec: (c) => `${rail(c)} OSFP active optical cables, rail and uplink, cut to each run`,
  },
  {
    id: "fabric_fiber",
    section: "fabric",
    label: "Fabric fiber, rail and uplink",
    unit: "each",
    qty: (s, c) => when(c.optics !== "aoc" && c.cabling === "direct", links(s)),
    spec: (c) => `${fiberType(c)} patch cords, end to end`,
  },
  {
    id: "fabric_trunk",
    section: "fabric",
    label: "Fabric fiber trunks",
    unit: "each",
    qty: (s, c) => when(c.optics !== "aoc" && c.cabling === "structured", Math.ceil(links(s) / LINKS_PER_TRUNK)),
    spec: (c) => `144-fiber MPO trunks, ${LINKS_PER_TRUNK} links each, ${singleMode(c) ? "OS2 single-mode" : "OM4 multimode"}`,
  },
  {
    id: "fabric_jumper",
    section: "fabric",
    label: "Fabric jumpers",
    unit: "each",
    qty: (s, c) => when(c.optics !== "aoc" && c.cabling === "structured", 2 * links(s)),
    spec: (c) => `${fiberType(c)} jumpers, 1 to 3 m, device to cassette at both ends`,
  },
  {
    id: "fabric_manager",
    section: "fabric",
    label: "Fabric manager appliances",
    unit: "each",
    kinds: ["ufm"],
    qty: (s) => s.fabricManagers,
    spec: () => `${SUPPORT.ufm.model}, HA pair`,
  },
  {
    id: "fabric_manager_license",
    section: "fabric",
    label: "Fabric manager licenses",
    unit: "each",
    qty: (s) => when(s.fabricManagers > 0, s.hostLinks + s.fabricManagers * UFM_HCAS),
    spec: (c) => `${valueLabel("ufm", c.ufm)}, per adapter, ${term(c)}`,
  },
  {
    id: "nvlink_manager_license",
    section: "fabric",
    label: "NVLink management licenses",
    unit: "each",
    qty: (s) => when(s.rackScale, s.gpus),
    spec: (c) => `NVIDIA NMX, per managed GPU, ${term(c)}`,
  },

  // Front-end, storage and out-of-band
  {
    id: "storage_switch",
    section: "network",
    label: "Front-end and storage switches",
    labelFor: (c) => (c.storageNetwork === "dedicated" ? "Front-end switches" : "Front-end and storage switches"),
    unit: "each",
    kinds: ["storageSwitch"],
    qty: (s) => s.storageSwitches,
    spec: () => `${SUPPORT.storageSwitch.model}, MLAG pairs`,
  },
  {
    id: "storage_fabric_switch",
    section: "network",
    label: "Storage fabric switches",
    unit: "each",
    kinds: ["storageSwitch"],
    qty: (s) => s.storageFabricSwitches,
    spec: () => `${SUPPORT.storageSwitch.model}, MLAG pairs, storage traffic only`,
  },
  {
    id: "storage_switch_power_cord",
    section: "network",
    label: "Front-end switch power cords",
    unit: "each",
    qty: (s) => frontEndSwitches(s) * SUPPORT.storageSwitch.psus,
    spec: () => `${SUPPORT.storageSwitch.psus} per switch`,
  },
  {
    id: "storage_switch_support",
    section: "network",
    label: "Front-end switch support",
    unit: "each",
    qty: frontEndSwitches,
    spec: support,
  },
  {
    id: "frontend_optics",
    section: "network",
    label: "Front-end optics and fiber",
    unit: "lot",
    qty: lot,
    spec: (c, s) =>
      `${count(frontEndNics(s, c) * 2)} front-end ports at ${c.frontEndNic === "b3240" ? "400G" : "200G"}, plus storage and switch uplinks · ${opticsSource(c)}`,
  },
  {
    id: "oob_switch",
    section: "network",
    label: "Out-of-band switches",
    unit: "each",
    kinds: ["oob"],
    qty: (s) => s.oob,
    spec: () => `${SUPPORT.oob.model}, 48 x 1GBASE-T`,
  },
  { id: "oob_switch_support", section: "network", label: "Out-of-band switch support", unit: "each", qty: (s) => s.oob, spec: support },
  {
    id: "console_server",
    section: "network",
    label: "Serial console server",
    unit: "each",
    qty: lot,
    spec: () => "32-port, with LTE out-of-band access",
  },
  {
    id: "switch_monitoring_license",
    section: "network",
    label: "Ethernet switch monitoring licenses",
    unit: "each",
    qty: (s, c) =>
      when(
        c.networkMonitoring,
        frontEndSwitches(s) + s.edge + s.oob + (c.networking === "infiniband" ? 0 : fabricSwitches(s)),
      ),
    spec: (c) => `NVIDIA NetQ, per switch, ${term(c)}`,
  },

  // Edge and security
  {
    id: "edge_router",
    section: "security",
    label: "Edge routers or border leaves",
    labelFor: (c) => (c.edge === "router" ? "Edge routers" : "Border leaf switches"),
    unit: "each",
    kinds: ["edge"],
    qty: (s) => s.edge,
    spec: (c) => `HA pair, ${valueLabel("wan", c.wan)} internet uplinks`,
  },
  { id: "edge_support", section: "security", label: "Edge support", unit: "each", qty: (s) => s.edge, spec: support },
  {
    id: "firewall",
    section: "security",
    label: "Firewalls",
    unit: "each",
    kinds: ["firewall"],
    qty: (s) => s.firewalls,
    spec: (c) => `Next-generation firewall HA pair, at least ${WAN_GBPS[c.wan]} Gb/s inspected`,
  },
  { id: "firewall_support", section: "security", label: "Firewall support", unit: "each", qty: (s) => s.firewalls, spec: support },
  {
    id: "wan_optics",
    section: "security",
    label: "WAN and firewall optics",
    unit: "lot",
    qty: lot,
    spec: (c) => `${valueLabel("wan", c.wan)} uplinks: ${c.wan === "2x400" ? "400G QSFP-DD LR4" : "100G QSFP28 LR4"} and breakouts`,
  },

  // Storage
  {
    id: "storage_node",
    section: "storage",
    label: "Storage nodes",
    unit: "each",
    kinds: ["nas"],
    qty: (s) => s.storageNodes,
    spec: (c, s) => {
      const p = STORAGE_PLATFORMS[c.storagePlatform];
      return `${p.node}, about ${count(p.usableTb)} TB usable each; ${count(s.nodes * c.storageTbPerNode)} TB needed`;
    },
  },
  {
    id: "storage_software",
    section: "storage",
    label: "Storage software",
    unit: "lot",
    qty: (s) => when(s.storageNodes > 0, 1),
    spec: (c, s) => `${STORAGE_PLATFORMS[c.storagePlatform].software}, ${count(s.nodes * c.storageTbPerNode)} TB usable, ${term(c)}`,
  },
  {
    id: "storage_install",
    section: "storage",
    label: "Storage installation",
    unit: "lot",
    qty: (s) => when(s.storageNodes > 0, 1),
    spec: (c) => `${STORAGE_PLATFORMS[c.storagePlatform].label} installation services`,
  },
  {
    id: "capacity_storage",
    section: "storage",
    label: "Capacity storage tier",
    unit: "lot",
    qty: (_, c) => when(c.capacityTierPb > 0, 1),
    spec: (c) => `${c.capacityTierPb} PB usable S3 object storage, for datasets and checkpoints`,
  },

  // Management and software
  {
    id: "mgmt_server",
    section: "management",
    label: "Management servers",
    unit: "each",
    kinds: ["mgmt"],
    qty: (s) => s.mgmt,
    spec: () => "CPU-only control plane: head, login, provisioning and monitoring",
  },
  {
    id: "server_support",
    section: "management",
    label: "Management and fabric manager server support",
    unit: "each",
    qty: (s) => s.mgmt + s.fabricManagers,
    spec: support,
  },
  {
    id: "cluster_software",
    section: "management",
    label: "Cluster management software",
    unit: "lot",
    qty: (_, c) => when(c.orchestration !== "customer", 1),
    spec: (c) => ORCHESTRATION[c.orchestration] || null,
  },
  {
    id: "ai_enterprise_license",
    section: "management",
    label: "NVIDIA AI Enterprise licenses",
    unit: "each",
    qty: (s, c) => when(c.aiEnterprise, s.gpus),
    spec: (c) => `Per GPU, ${term(c)}`,
  },

  // Racks, power and cooling
  {
    id: "cabinet",
    section: "rack",
    label: "Cabinets",
    unit: "each",
    qty: (s) => s.cabinets,
    spec: (c) => `${c.rackU}U, 800 x 1200 mm${hgx(c) ? "" : ", network racks; the rack-scale systems bring their own"}`,
  },
  {
    id: "rack_pdu",
    section: "rack",
    label: "Rack PDUs",
    unit: "each",
    qty: (s, c) => (hgx(c) ? s.computeRacks * pdusPerRack(c, "compute") : 0) + s.networkRacks * pdusPerRack(c, "network"),
    spec: (c) => `${PDU[c.pdu]}, ${c.power === "2n" ? "A and B feeds" : "one feed"}`,
  },
  {
    id: "manifold",
    section: "rack",
    label: "Coolant manifolds",
    unit: "each",
    kinds: ["manifold"],
    qty: (s) => s.manifolds,
    spec: () => "Supply and return, one dripless quick-disconnect per node",
  },
  {
    id: "cdu",
    section: "rack",
    label: "In-rack CDUs",
    labelFor: (c) => (c.cdu === "in_row" ? "In-row CDUs" : "In-rack CDUs"),
    unit: "each",
    qty: (s, c) =>
      !liquid(c) || c.cdu === "facility"
        ? 0
        : c.cdu === "in_row"
          ? Math.max(2, Math.ceil(s.computeKw / IN_ROW_CDU_KW) + 1)
          : s.computeRacks,
    spec: (c, s) =>
      c.cdu === "in_row"
        ? `About ${count(IN_ROW_CDU_KW)} kW each, N+1, for ${count(Math.round(s.computeKw))} kW of compute`
        : "Liquid-to-liquid, one per compute rack",
  },
  {
    id: "leak_detection",
    section: "rack",
    label: "Leak detection",
    unit: "each",
    qty: (s, c) => when(liquid(c), s.computeRacks),
    spec: () => "One per liquid-cooled rack",
  },
  {
    id: "patch_panel",
    section: "rack",
    label: "Fiber patch panels",
    unit: "each",
    kinds: ["panel"],
    qty: (s) => s.panels,
    spec: (c) =>
      c.cabling === "structured" && c.optics !== "aoc" ? "1U MPO cassette enclosures, trunk to jumper" : "1U MPO-16 panels",
  },
  {
    id: "rack_integration",
    section: "rack",
    label: "Rack and stack",
    unit: "each",
    qty: (s) => s.computeRacks,
    spec: (c) => (hgx(c) ? "Per compute rack, power cords labeled" : "Per rack-scale system: set, power and coolant hookup"),
  },
  { id: "rack_warranty", section: "rack", label: "Rack and CDU warranty", unit: "lot", qty: lot, spec: support },

  // Services
  {
    id: "integration_services",
    section: "services",
    label: "Integration and field engineering",
    unit: "lot",
    qty: lot,
    spec: (c) =>
      c.integration === "offsite"
        ? "Off-site rack integration (L11), cabled and tested, then trucked to site"
        : "On-site integration, cabling and implementation",
  },
  {
    id: "configuration_services",
    section: "services",
    label: "Configuration and bring-up",
    unit: "lot",
    qty: lot,
    spec: (c) => (c.orchestration === "customer" ? "Bare-metal handover: firmware, BMC, fabric and OS" : null),
  },
  {
    id: "acceptance_testing",
    section: "services",
    label: "Burn-in and acceptance testing",
    unit: "lot",
    qty: (_, c) => when(c.burnIn, 1),
    spec: () => "Burn-in, HPL, NCCL all-reduce and storage benchmarks against the acceptance criteria",
  },
  {
    id: "freight",
    section: "services",
    label: "Freight",
    unit: "lot",
    qty: lot,
    spec: (c) => (c.integration === "offsite" ? "Inbound to the integrator, then crated racks to site" : "Inbound to site"),
  },
  {
    id: "spare_nodes",
    section: "services",
    label: "Spare nodes",
    labelFor: (c) => (hgx(c) ? "Spare nodes" : "Spare compute trays"),
    unit: "each",
    qty: (s, c) => spares(c, s.nodes),
    spec: (c) => `${c.sparesPct}% of the phase's`,
  },
  {
    id: "spare_optics",
    section: "services",
    label: "Spare optics",
    unit: "each",
    qty: (s, c) => spares(c, nodeTransceivers(s, c) + switchTransceivers(s, c) + aocs(s, c)),
    spec: (c) => `${c.sparesPct}% of the fabric's transceivers or cables`,
  },
  { id: "spares", section: "services", label: "Other spares", unit: "lot", optional: true, qty: lot },
];

const BY_ID = new Map(SLOTS.map((slot) => [slot.id, slot]));

export const slotById = (id: string): Slot | undefined => BY_ID.get(id);
export const isSlotId = (id: string): boolean => BY_ID.has(id);

/** A slot as configuration `c` has it: what it's called and what to quote. */
export interface SlotView {
  slot: Slot;
  label: string;
  spec: string | null;
}

export const viewSlot = (slot: Slot, c: ResolvedConfig, s: Sizing): SlotView => ({
  slot,
  label: slot.labelFor?.(c) ?? slot.label,
  spec: slot.spec?.(c, s) ?? null,
});

/** Every slot the phase needs, with how many, in section order. */
export function requiredSlots(s: Sizing, c: ResolvedConfig): (SlotView & { qty: number })[] {
  const order = new Map(SLOT_SECTIONS.map((section, i) => [section.id, i]));
  return SLOTS.map((slot) => ({ slot, qty: slot.qty(s, c) }))
    .filter((row) => row.qty > 0)
    .map((row) => ({ ...viewSlot(row.slot, c, s), qty: row.slot.unit === "lot" ? 1 : row.qty }))
    .sort((a, b) => order.get(a.slot.section)! - order.get(b.slot.section)!);
}
