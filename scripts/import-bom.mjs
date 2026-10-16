/**
 * Copies the Pegatron and Computacenter quotes for a 64-node B300 cluster
 * into a deployment phase's BOM in DATABASE_URL, line by line under each
 * quote's own sections, with every line's cluster-builder slots
 * (src/features/cluster/model/slots.ts). Lines the cluster doesn't need stay
 * in, excluded with the reason. Gives the phase its builder config when it
 * has none, then prints how the BOM covers its slots.
 *
 *   npm run bom:import                                                    (dev)
 *   node --env-file=.env.production.local scripts/import-bom.mjs          (production)
 *
 * Takes the "CORE - 64 MW" deployment's first 64-node phase unless
 * `--deployment=<id>` and `--phase=<id>` name one. Each quote is linked to
 * the file of the same name in the deployment's data room, when it has one.
 * Re-runnable: a quote is matched on `seed_key` and skipped once imported.
 */
import { randomUUID } from "node:crypto";
import { registerHooks } from "node:module";
import { neon } from "@neondatabase/serverless";

const SRC = new URL("../src/", import.meta.url);

// The app's TypeScript imports omit the extension and use the `@/` alias, as the bundler allows.
registerHooks({
  resolve(specifier, context, next) {
    const target = specifier.startsWith("@/") ? new URL(specifier.slice(2), SRC).href : specifier;
    try {
      return next(target, context);
    } catch (error) {
      if (/^(\.|file:)/.test(target) && !/\.[cm]?[jt]s$/.test(target)) return next(`${target}.ts`, context);
      throw error;
    }
  },
});

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[bom:import] DATABASE_URL must be set.");
  process.exit(1);
}

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;

/** The cluster the quotes price: 64 B300 nodes in 8 liquid-cooled racks, on a non-blocking InfiniBand fabric. */
const CLUSTER = {
  platform: "b300",
  nodes: 64,
  density: 8,
  fabric: "infiniband",
  oversubscription: 1,
  rackU: 48,
  rowLength: 12,
  storagePerNode: 4,
};

/**
 * `[partNumber, description, quantity, unitUsd, fills, extra]`. `fills` maps
 * slot ids to the slot units each item covers; `extra` sets `lead`, `notes`
 * or `excluded` (the reason). A null `unitUsd` is priced inside another line.
 */
const line = (partNumber, description, quantity, unitUsd, fills = {}, extra = {}) => ({
  partNumber,
  description,
  quantity,
  unitUsd: unitUsd === null ? null : Math.round(unitUsd * 1e6) / 1e6,
  fills: extra.excluded ? {} : fills,
  ...extra,
});

const EO_DUPLICATE = (pn, lead) =>
  `Third-party duplicate of ${pn}, quoted for 4-6 week delivery against ${lead} for the NVIDIA part. Swap it in if lead time matters.`;

const PEGATRON_FILE = "pegatron-(Zode) B300 DLC_Ark_48U InRack_bugetary quotation (1).pdf";
const COMPUTACENTER_FILE = "computa-center-ZODE_64 Node Cluster Options v1.2.xlsx";

/**
 * Pegatron quotes 128 nodes in 16 racks with 16 CDUs; the phase takes its
 * own node count at the same unit prices. Each section's `per` is what one
 * of its line quantities is for, and how many the quote buys.
 */
const PEGATRON = {
  seed_key: "pegatron-260806-1812",
  vendor: "Pegatron",
  reference: "260806/1812",
  quoted_on: "2026-08-06",
  valid_until: "2026-08-13",
  quoted_total_usd: 71_078_418.56,
  file: PEGATRON_FILE,
  notes:
    "Budgetary quotation for 128 AS402-2A1-8H2 B300 systems, 16 racks and 16 in-rack CDUs; this phase takes its own node count at the quoted unit prices. Quote expires 7 days from issue. Delivery to the USA.",
  sections: [
    {
      title: "AI Server (L6 or L7 Barebone)",
      per: { quoted: 128, phase: (nodes) => nodes },
      lines: [
        line("AS402-2A1-8H2", "AS402-2A1-8H2 4U 2-Socket Intel Xeon Processors, B300 (Ark)", 1, 530_901, { gpu_node: 1 }, {
          notes: "Per-unit subtotal of $541,519.02 less the warranty line below.",
        }),
        line(null, "L6 barebone AS402-2A1-8H2 4U", 1, null),
        line(null, "GPU B300 DLC: GPU HGX B300 NVL8 PC", 1, null, { gpu_baseboard: 1 }),
        line(null, "Assembly and integration: AS402-2A1-8H2 4U (direct liquid cooling)", 1, null, { node_integration: 1 }),
        line("1.5meter", "Power cord (North America) C19 to C20, 1.5 meter, 16A, 14AWG", 10, null, { node_power_cord: 1 }),
        line(null, "Intel Xeon 6776P (64-core) 2.3GHz, Max Turbo 3.9GHz, 336M cache, TDP 350W", 2, null, { node_cpu: 1 }),
        line(null, "RDIMM DDR5 6400MT/s, 96GB", 32, null, { node_memory: 1 }),
        line(null, "SSD U.2: PCIe 4.0 U.2 7mm 960GB (1DWPD)", 2, null, { node_boot_drive: 1 }),
        line(null, "U.2 NVMe: PCIe 5.0 U.2 PM9D3a 3.84TB", 6, null, { node_nvme: 1 }),
        line(null, "NVIDIA B3220 crypto disabled, PCIe 5.0 x16, QSFP112 2-port 200GbE", 2, null, { node_frontend_nic: 1 }),
        line(null, "Trusted Platform Module (TPM) 2.0 TPM-SPI", 1, null),
        line("L6 3YR Parts", "Warranty: 3 years RTV (parts only, one way)", 1, 10_618.02, { node_warranty: 1 }),
      ],
    },
    {
      title: "Rack",
      per: { quoted: 16, phase: (nodes) => nodes / CLUSTER.density },
      lines: [
        line(null, '48U 19" rack', 1, 33_874.92, { cabinet: 1 }, {
          notes: "Per-rack subtotal of $35,467.00 less the warranty line below.",
        }),
        line(null, "PDU 24 socket (with IEC industrial plug adapter cable, 4m cord)", 4, null, { rack_pdu: 1 }),
        line(null, "Rack manifold, left (5 gal)", 1, null, { manifold: 1 }),
        line(null, "Rack manifold, right (5 gal)", 1, null, { manifold: 1 }),
        line(null, "Leak detector (PDU)", 1, null, { leak_detection: 1 }),
        line(null, "Leak detection tray pan", 1, null),
        line(null, "Blanking panel", 8, null),
        line(null, "Rack and stack package, power cord labeling included", 1, null, { rack_integration: 1 }),
        line(null, "Wooden crate: rack packing material", 1, null),
        line("L6 3YR Parts", "Warranty: 3 years RTV (parts only, one way)", 1, 1_592.08, { rack_warranty: 1 }),
      ],
    },
    {
      title: "In rack CDU",
      per: { quoted: 16, phase: (nodes) => nodes / CLUSTER.density },
      lines: [
        line("KC0150", "In-rack CDU", 1, 74_782, { cdu: 1 }),
        line("Pega 3yrs DLC", "DLC 3 years onsite services warranty, parts and labor", 1, null, { rack_warranty: 1 }),
      ],
    },
  ],
};

/** Computacenter quotes the 64-node cluster's network, management, storage and services as the phase takes them. */
const COMPUTACENTER = {
  seed_key: "computacenter-64-node-v1.2",
  vendor: "Computacenter",
  reference: "ZODE 64 Node Cluster Options v1.2",
  quoted_on: null,
  valid_until: null,
  quoted_total_usd: 11_870_660.51,
  file: COMPUTACENTER_FILE,
  notes:
    "64 Node Full Network: InfiniBand fabric, Ethernet, management, VAST storage (1PB), firewalls, spares, professional services and freight. Integrated at Computacenter's integration center and trucked to the colo.",
  sections: [
    {
      title: "Network, Management Nodes, Storage Racks & PDUs, OOB",
      lines: [
        line("VP7N60AC", "rPDU, Switched Outlet Level Monitoring EC, 60A, 208V Delta, 17.2kW, Vertical, (48) Combination C13/C19, 10ft / 3m power cord with 3P+E (IP67), Black Powder Coat", 12, null, { rack_pdu: 1 }, {
          notes: "Networking and storage racks.",
        }),
        line("VR3357", "Vertiv VR Rack - 48U Server Rack Enclosure, 800x1200mm, 19-inch Cabinet (VR3357) - 2265x800x1200mm (HxWxD), 77% perforated doors, Side", 6, null, { cabinet: 1 }),
        line("OM2232-L", "32 SERIAL PT64GBSSD DOCKER SPT 1GBE SFP4G LTEDUAL ACC14 PWR CRD, 3-YR Foundation Support", 1, null, { console_server: 1 }),
        line(null, "Section subtotal: PDUs, racks and console server above", 1, 75_000, {}, {
          notes: "The quote prices this section as a $75,000 subtotal, its unit prices TBD.",
        }),
      ],
    },
    {
      title: "CPU Compute",
      lines: [
        line("210-BNMV", "PowerEdge R7725 Server (control plane)", 6, 53_038.312533333316, { mgmt_server: 1 }, { lead: "90 Days" }),
        line("321-BLDM", "Chassis with up to 8 E3.S NVMe Direct Drives", 6, null),
        line("338-CRRV", "AMD EPYC 9255 3.20GHz, 24C/48T, 128 Cache (200W) DDR5-6400", 6, null),
        line("338-CRRV, 379-BDCO", "AMD EPYC 9255 3.20GHz, 24C/48T, 128 Cache (200W) DDR5-6400", 6, null),
        line("370-BCCX", "6400MT/s RDIMMs", 6, null),
        line("370-BCCZ", "64GB RDIMM, 6400MT/s, Dual Rank", 48, null),
        line("780-BCDO", "C30, No RAID for NVME chassis", 6, null),
        line("345-BKFS", "3.2TB Data Center NVMe Mixed Use AG Drive E3s Gen5 with carrier", 12, null),
        line("800-BBDM", "UEFI BIOS Boot Mode with GPT Partition", 6, null),
        line("384-BDTQ", "PowerEdge 2U High Performance Platinum Fan", 6, null),
        line("450-BCWT", "Dual, Fully Redundant (1+1), Hot-Plug MHS Power Supply, 1500W MM, Titanium", 6, null),
        line("492-BBDG", "C13 to C14, PDU Style, 12 AMP, 13 Feet (4m) Power Cord, North America", 12, null),
        line("330-BCYK", "Riser Config 4, 2 x16 LP Slots (Gen5), 2 x16 DW Slots (Gen5), 2nd OCP", 6, null),
        line("329-BLHX", "PowerEdge R7725 Motherboard V2 - non PE", 6, null),
        line("540-BFPX", "Broadcom 57412 Dual Port 10GbE BASE-T Adapter, OCP 3.0 NIC +Sec", 6, null),
        line("470-BCHM", "1 OCP - 1 Rear Blank, No Cable", 6, null),
        line("352-BBCQ", "Partner DPU, NVIDIA BlueField-3 Dual Port 200GbE/NDR200 PCIe Full Height", 6, null),
        line("403-BDMC", "BOSS-N1 controller card + with 2 M.2 960GB (RAID 1) (22x80) Rear", 6, null),
        line("634-CSHS, 634-CSHT, 634-CSHV", "iDRAC10, Datacenter 17G", 6, null),
        line("379-BFXS, 634-CZRP", "Dell Connectivity Client - Enabled 17G", 6, null),
        line("770-BECC", "ReadyRails Sliding Rails Without Cable Management Arm", 6, null),
        line("865-BBMY", "ProSupport and Next Business Day Onsite Service, 36 Month(s)", 6, 3_182.9354666666654, { server_support: 1 }),
        line("210-BNMV", "PowerEdge R7725 Server (UFM appliance)", 2, 37_953.76079777778, { fabric_manager: 1 }, { lead: "90 Days" }),
        line("321-BLDM", "Chassis with up to 8 E3.S NVMe Direct Drives", 2, null),
        line("338-CRCJ", "AMD EPYC 9135 3.65GHz, 16C/32T, 64 Cache (200W) DDR5-6400", 2, null),
        line("338-CRCJ, 379-BDCO", "AMD EPYC 9135 3.65GHz, 16C/32T, 64 Cache (200W) DDR5-6400", 2, null),
        line("370-BCCX", "6400MT/s RDIMMs", 2, null),
        line("370-BCCZ", "64GB RDIMM, 6400MT/s, Dual Rank", 8, null),
        line("780-BCDO", "C30, No RAID for NVME chassis", 2, null),
        line("345-BKFS", "3.2TB Data Center NVMe Mixed Use AG Drive E3s Gen5 with carrier", 4, null),
        line("800-BBDM", "UEFI BIOS Boot Mode with GPT Partition", 2, null),
        line("384-BDTQ", "PowerEdge 2U High Performance Platinum Fan", 2, null),
        line("450-BCWT", "Dual, Fully Redundant (1+1), Hot-Plug MHS Power Supply, 1500W MM, Titanium", 2, null),
        line("492-BBDI", "C13 to C14, PDU Style, 12 AMP, 6.5 Feet (2m) Power Cord, North America", 4, null),
        line("330-BCYK", "Riser Config 4, 2 x16 LP Slots (Gen5), 2 x16 DW Slots (Gen5), 2nd OCP", 2, null),
        line("329-BLHX", "PowerEdge R7725 Motherboard V2 - non PE", 2, null),
        line("540-BFPX", "Broadcom 57412 Dual Port 10GbE BASE-T Adapter, OCP 3.0 NIC +Sec", 2, null),
        line("540-BFKF", "Nvidia ConnectX-7 Single Port NDR VPI/400GbE OSFP-RHS Adapter, No Crypto, PCIe Full Height +Sec", 4, null),
        line("403-BDMC", "BOSS-N1 controller card + with 2 M.2 960GB (RAID 1) (22x80) Rear", 2, null),
        line("634-CSHS, 634-CSHT, 634-CSHV", "iDRAC10, Datacenter 17G", 2, null),
        line("379-BFXS, 634-CZRP", "Dell Connectivity Client - Enabled 17G", 2, null),
        line("770-BECC", "ReadyRails Sliding Rails Without Cable Management Arm", 2, null),
        line("865-BBMY", "ProSupport and Next Business Day Onsite Service, 36 Month(s)", 2, 2_277.6805888888885, { server_support: 1 }),
        line("797-XUFETA+P2CMI36", "NVIDIA Unified Fabric Manager (UFM) Enterprise + Business Standard - Subscription - Up to 1000 InfiniBand Adapters (HCAs) - 3 Year", 516, 137.65333333333334, { fabric_manager_license: 1 }, {
          notes: "512 GPUs and 4 UFM adapters.",
        }),
        line("797-XNMX1K+P2CMI36", "SVCS NMX SUBSCRIPTION SW W/BUS STAND (PER MANAGED GPU) 3 YR", 516, 137.48888888888888, {}, {
          excluded:
            "NMX manages NVLink switch trays, which only NVL72 racks have; HGX B300 nodes keep NVLink inside each node, so there's nothing for it to manage.",
        }),
        line("UPGR-CUM-NETQ2-SUB-10G-3YR", "NetQ On-Prem 10G or greater switch SW subscription with Business Standard support, 3Y", 12, 1_481.4833333333333, { switch_monitoring_license: 1 }),
        line("UPGR-CUM-NETQ2-SUB-1G-3YR", "NetQ On-Prem 1G or greater switch SW subscription with Business Standard support, 3Y", 10, 1_481.4833333333333, { switch_monitoring_license: 1 }),
      ],
    },
    {
      title: "Networking Switches",
      lines: [
        line("Q3400-RA (920-9B36F-00RX-8S0)", "NVDA Q3400-RA, 4U, 144 port via 72 OSFP224 ports, 8 AC, Managed C2P (I/P) Airflow", 12, 96_716.36956521738, { fabric_switch: 1 }, {
          lead: "20-24 Weeks",
          notes: "4 spine and 8 leaf.",
        }),
        line("930-9BPWA-00NA-000", "NVDA, XDR, Pwr Cord 15A C14 to C15 UL (2pack)", 96, 28.456521739130434, { fabric_switch_power_cord: 1 }),
        line("790-SX4NNZ+P2CMI36", "NVIDIA ENTBSNSSTDSPTSRVCSNBD SVCS ON-SITE CE Q3400-RA AIR COOLED 3 YR", 12, 28_048.032608695648, { fabric_switch_support: 1 }),
        line("SN5610 / 920-9N42F-00RI-3C1", "NVDA SN5610 2U 64xOSFP112, 4AC PSU, C2P (I/P) Airflow, w/ Cumulus", 10, 54_806.510869565216, { storage_switch: 1 }, {
          lead: "30-34 Weeks",
          notes: "TAN consolidated switches. The quote's summary sheet lists 40 power cords for them that its detail doesn't price.",
        }),
        line("781-S56NNZ+P2CMI36", "ENT BUS STD SUP SVCS SN5600 SVCS CL 3 YEARS", 10, 7_672.434782608696, { storage_switch_support: 1 }),
        line("MSN4700-WS2RC", "MSN4700-WS2RC border leaf switch", 2, 28_239.934782608696, { edge_router: 1 }, { lead: "16-20 Weeks" }),
        line("781-C47NNZ+P2CMI36", "ENT BUS STD SUP SVCS MSN4700 SVCS CL 3 YEARS", 2, 10_449.065217391304, { edge_support: 1 }),
        line("MSN2201-CB2RC", "NVDA SN2201 48x1GBaseT, 1U, 2AC PSU, C2P (P/I) Airflow, w/ Cumulus", 10, 2_450.4891304347825, { oob_switch: 1 }, { lead: "16-20 Weeks" }),
        line("781-S23N0Z+C2PMI36", "3YR TECH SUP AND WARRANTY BUS SVCS STD FOR SN2201-CL SERIES SWITCH", 10, 857.925, { oob_switch_support: 1 }),
      ],
    },
    {
      title: "InfiniBand / Ethernet Optics & Cables",
      lines: [
        line("MMS4A00-XM", "NVDA twin port, 1.6Tbps, 2x800 XDR, OSFP, 2xMPO12, 1310 SMF, up to 500m, 2xDR4 finned, IHS", 832, 2_257, { switch_transceiver: 1 }, { lead: "30-24 weeks" }),
        line("MMS4A20-XM800", "NVDA, single port 800Gbps XDR, OSFP, MPO12, 1310nm SMF, DR4, up to 500m, flat top", 512, 1_593.445652173913, { node_transceiver: 1 }, { lead: "30-34 Weeks" }),
        line("MMS4X00-NM", "NVIDIA twin port transceiver, 800Gb/s 2x400Gb/s Twin-port OSFP, 2xDR4 SMF, up to 500m, finned", 4, 1_625.7391304347825, {}, { lead: "20-26 Weeks" }),
        line("MMS4X00-NS400", "NVIDIA Single port transceiver, 400Gbps, NDR, OSFP, MPO, 1310nm SMF, up to 500m, flat top", 4, 952.8913043478261, {}, { lead: "20-26 Weeks" }),
        line("MMS4A00-XM-EO", "1600Gbps, 2xDR4, Twin-port OSFP, 2xMPO, 1310nm Single Mode (500m) Transceiver - Nvidia Compatible", 832, 1_361.111111111111, {}, {
          lead: "4-6 weeks",
          excluded: EO_DUPLICATE("MMS4A00-XM", "30-34 weeks"),
        }),
        line("MMS4A20-XM800-EO", "800Gbps, DR4 Single-port OSFP, MPO, 1310nm Single Mode, RHS (500m) Transceiver - Nvidia Compatible", 512, 1_086.6666666666667, {}, {
          lead: "4-6 weeks",
          excluded: EO_DUPLICATE("MMS4A20-XM800", "30-34 weeks"),
        }),
        line("MMS4X00-NM-T-EO", "800Gbps Twin-port OSFP 2x400Gb/s Ethernet Single Mode 2xDR4 500m - Nvidia Compatible", 216, 558.8235294117648, { frontend_optics: 1 }, { lead: "4-6 weeks" }),
        line("MMS1X00-NS400-T-EO", "400GBase-DR4 QSFP112 Transceiver (SMF, 100m, MPO-12 APC) Nvidia Compatible", 164, 464.7058823529412, { frontend_optics: 1 }, { lead: "4-6 weeks" }),
        line("MMS1V00-WM-EO", "NVIDIA 400G QDFP-DD DR4 SMF optical transceiver - Nvidia Compatible", 12, 481.25, { frontend_optics: 1 }, { lead: "4-6 weeks" }),
        line("MMS1V70-CM-EO", "100GBase-DR QSFP28 Single Lambda Transceiver (SMF, 1310nm, 500m, LC, DOM, with FEC) Mellanox Compatible", 20, 170.58823529411765, { wan_optics: 1 }, { lead: "4-6 weeks" }),
        line("MMA1L10-CR-EO", "Mellanox optical module, 100GbE, 100Gb/s, QSFP28, LC-LC, 1310nm, LR4, up to 10km", 4, 285, { wan_optics: 1 }, { lead: "4-6 weeks" }),
        line("MFP7E30-N010-EO", "MPO12 APC to MPO12 APC Singlemode Passive Fiber Cable, 10m", 398, 32.5, { fabric_fiber: 1 }, { lead: "4-6 weeks" }),
        line("MFP7E30-N020-EO", "MPO12 APC to MPO12 APC Singlemode Passive Fiber Cable, 20m", 776, 40, { fabric_fiber: 1 }, { lead: "4-6 weeks" }),
        line("MFP7E30-N030-EO", "MPO12 APC to MPO12 APC Singlemode Passive Fiber Cable, 30m", 312, 52.5, { fabric_fiber: 1 }, { lead: "4-6 weeks" }),
        line("MFP7E40-N010-EO", "MPO12 APC to 2x MPO12 APC Singlemode Passive Fiber Splitter Cable, 10m", 10, 36.25, { frontend_optics: 1 }, { lead: "4-6 weeks" }),
        line("MFP7E40-N020-EO", "MPO12 APC to 2x MPO12 APC Singlemode Passive Fiber Splitter Cable, 20m", 10, 48.75, { frontend_optics: 1 }, { lead: "4-6 weeks" }),
        line("EO-MPO(F)4LCSDY-20M", "MTP-F to 4xLC Duplex Single Mode OS2 Breakout Cable - 20M", 4, 52.5, { wan_optics: 1 }, { lead: "4-6 weeks" }),
        line("EO-MPO(F)4LCSDY-50M", "MTP-F to 4xLC Duplex Single Mode OS2 Breakout Cable - 50M", 4, 72.5, { wan_optics: 1 }, { lead: "4-6 weeks" }),
      ],
    },
    {
      title: "VAST SW & SMC Ebox Storage 1PB",
      lines: [
        line("SW-U-1", "VAST capacity: 1TB Useable 1-Month Gemini Services Term", 1206, 389.27, { storage_software: 1 }),
        line("SW-CORE-1", "VAST cores: Single CPU Core 1-Month Gemini Services Term (768 licensable CPU cores in scope)", 768, 669.6, { storage_software: 1 }),
        line("INSTALL", "VAST Data Installation Services", 1, 19_200, { storage_install: 1 }),
        line("AS -1115HS-TNR-OTO-1", "SMC 138 Ebox Nodes / 64 Core - 9 x 15.36TB Drives", 12, 118_146.81, { storage_node: 1 }, { lead: "90 Days" }),
      ],
    },
    {
      title: "Firewalls (Fortinet 3000G HA)",
      lines: [
        line("FG-3000G", "FORTIGATE-3000G 6 X 100GE QSFP28 SLOTS 16 X 10GE SFP+/25GE", 2, 115_115, { firewall: 1 }, { lead: "60 Days" }),
        line("FC-10-G3K0G-247-02-36", "FORTIGATE-3000G 3YR FORTICARE PREMIUM SUPPORT", 2, 72_800, { firewall_support: 1 }),
        line("FN-TRAN-QSFP28-DR", "100GE QSFP28 TRANSCEIVERS", 4, 1_808.04, { wan_optics: 1 }),
        line("FN-TRAN-QSFP+LR", "FN-CABLE-QSFP28-1", 2, 1_218.8444444444444, { wan_optics: 1 }, {
          notes: "The quote's description repeats the next line's part number.",
        }),
        line("FN-CABLE-QSFP28-1", "4 x 25G SFP28 Passive Direct Attach Copper Breakout Cable", 2, 112, { wan_optics: 1 }),
      ],
    },
    {
      title: "Spares",
      lines: [line(null, "Spares", 1, 225_000, { spares: 1 }, { notes: "Allowance; the quote lists the price as TBD." })],
    },
    {
      title: "Professional Services",
      lines: [
        line("CC-PS", "Integration Center & Field Engineering Services: Deploy, Cabling, Implementation", 1, 850_000, { integration_services: 1 }),
        line("CC-PS", "Configuration Services", 1, 300_000, { configuration_services: 1 }),
      ],
    },
    {
      title: "Freight",
      lines: [
        line("Freight", "Inbound shipping to the CC Integration Center for items purchased from Computacenter", 1, 5_000, { freight: 1 }),
        line("Freight", "Dedicated truck from CC-IC to Zode colo", 8, 15_000, { freight: 1 }),
      ],
    },
  ],
};

const sql = neon(url);

const deploymentId = arg("deployment");
const [deployment] = deploymentId
  ? await sql`select id, name, data_room_id from deployments where id = ${deploymentId}`
  : await sql`select id, name, data_room_id from deployments where name = 'CORE - 64 MW' order by created_at limit 1`;
if (!deployment) {
  console.error(`[bom:import] No deployment ${deploymentId ?? '"CORE - 64 MW"'}; pass --deployment=<id>.`);
  process.exit(1);
}

const phaseId = arg("phase");
const phases = await sql`
  select id, name, platform, nodes, cluster_config from deployment_phases
  where deployment_id = ${deployment.id} order by position, rfs_on`;
const phase = phaseId
  ? phases.find((p) => p.id === phaseId)
  : phases.find((p) => p.nodes === CLUSTER.nodes && p.platform === CLUSTER.platform);
if (!phase) {
  console.error(`[bom:import] ${deployment.name} has no ${phaseId ? `phase ${phaseId}` : `${CLUSTER.nodes}-node B300 phase`}; pass --phase=<id>.`);
  process.exit(1);
}
if (phase.nodes !== CLUSTER.nodes || phase.platform !== CLUSTER.platform) {
  console.error(`[bom:import] The phase is ${phase.nodes} ${phase.platform} nodes; the quotes are for ${CLUSTER.nodes} B300.`);
  process.exit(1);
}
const phaseName = phase.name ?? `Phase ${phases.indexOf(phase) + 1}`;

/** The quote's lines as BOM items for the phase, each with the quote's own quantity when the phase takes another. */
function itemsOf(quote) {
  return quote.sections.flatMap((section) => {
    const quoted = section.per?.quoted ?? 1;
    const taken = section.per?.phase(phase.nodes) ?? 1;
    return section.lines.map((l) => ({
      ...l,
      section: section.title,
      quantity: l.quantity * taken,
      quotedQuantity: quoted === taken ? null : l.quantity * quoted,
    }));
  });
}

const sumUsd = (items, qty) => items.reduce((sum, i) => sum + (i.unitUsd === null ? 0 : qty(i) * i.unitUsd), 0);
const money = (v) => v.toLocaleString("en-US", { style: "currency", currency: "USD" });

const existing = await sql`select seed_key from deployment_quotes where seed_key is not null`;
const seeded = new Set(existing.map((r) => r.seed_key));
const [{ next_position: firstQuotePosition }] =
  await sql`select coalesce(max(position) + 1, 0) as next_position from deployment_quotes where deployment_id = ${deployment.id}`;
const [{ next_position: firstItemPosition }] =
  await sql`select coalesce(max(position) + 1, 0) as next_position from deployment_bom_items where deployment_id = ${deployment.id}`;
const files = deployment.data_room_id
  ? await sql`select id, name from data_room_files where room_id = ${deployment.data_room_id} and deleted_at is null`
  : [];

let quotePosition = firstQuotePosition;
let itemPosition = firstItemPosition;
let failed = false;

for (const quote of [PEGATRON, COMPUTACENTER]) {
  if (seeded.has(quote.seed_key)) {
    console.log(`[bom:import] ${quote.vendor} ${quote.reference}: already imported, skipped.`);
    continue;
  }
  const items = itemsOf(quote);
  const quotedUsd = sumUsd(items, (i) => i.quotedQuantity ?? i.quantity);
  if (Math.abs(quotedUsd - quote.quoted_total_usd) >= 1) {
    console.error(`[bom:import] ${quote.vendor}: lines total ${money(quotedUsd)} against the quote's ${money(quote.quoted_total_usd)}; not imported.`);
    failed = true;
    continue;
  }

  const quoteId = randomUUID();
  const file = files.find((f) => f.name === quote.file) ?? null;
  const rows = items.map((i) => ({
    id: randomUUID(),
    quote_section: i.section,
    position: itemPosition++,
    part_number: i.partNumber,
    description: i.description,
    quantity: i.quantity,
    quoted_quantity: i.quotedQuantity,
    unit_usd: i.unitUsd,
    status: i.excluded ? "excluded" : "use",
    excluded_reason: i.excluded ?? null,
    lead_time: i.lead ?? null,
    notes: i.notes ?? null,
    fills: i.fills,
  }));
  const fills = rows.flatMap((r) =>
    Object.entries(r.fills).map(([slot_id, units_per_item]) => ({ item_id: r.id, slot_id, units_per_item })),
  );

  await sql.transaction([
    sql`
      insert into deployment_quotes
        (id, deployment_id, position, vendor, reference, quoted_on, valid_until, quoted_total_usd, data_room_file_id, notes, seed_key)
      values
        (${quoteId}, ${deployment.id}, ${quotePosition++}, ${quote.vendor}, ${quote.reference}, ${quote.quoted_on},
         ${quote.valid_until}, ${quote.quoted_total_usd}, ${file?.id ?? null}, ${quote.notes}, ${quote.seed_key})`,
    sql`
      insert into deployment_bom_items
        (id, deployment_id, phase_id, quote_id, quote_section, position, part_number, description,
         quantity, quoted_quantity, unit_usd, status, excluded_reason, lead_time, notes)
      select r.id, ${deployment.id}, ${phase.id}, ${quoteId}, r.quote_section, r.position, r.part_number, r.description,
             r.quantity, r.quoted_quantity, r.unit_usd, r.status, r.excluded_reason, r.lead_time, r.notes
      from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) as r(
        id uuid, quote_section text, position integer, part_number text, description text, quantity numeric,
        quoted_quantity numeric, unit_usd numeric, status text, excluded_reason text, lead_time text, notes text)`,
    sql`
      insert into deployment_bom_fills (item_id, slot_id, units_per_item)
      select f.item_id, f.slot_id, f.units_per_item
      from jsonb_to_recordset(${JSON.stringify(fills)}::jsonb) as f(item_id uuid, slot_id text, units_per_item numeric)`,
  ]);

  const excluded = rows.filter((r) => r.status === "excluded").length;
  console.log(
    `[bom:import] ${quote.vendor} ${quote.reference}: ${rows.length} lines (${excluded} excluded), ${money(quotedUsd)} as quoted, ` +
      `${money(sumUsd(items.filter((i) => !i.excluded), (i) => i.quantity))} in ${phaseName}. ` +
      (file ? `Linked to ${file.name}.` : deployment.data_room_id ? `No "${quote.file}" in the data room.` : "No data room to link."),
  );
}

if (!phase.cluster_config) {
  await sql`update deployment_phases set cluster_config = ${JSON.stringify(CLUSTER)}::jsonb, cluster_copies = 1 where id = ${phase.id}`;
  console.log(`[bom:import] ${phaseName} set to the builder's ${CLUSTER.nodes}-node ${CLUSTER.platform.toUpperCase()} cluster.`);
}

// How the phase's BOM, whatever's in it now, covers the slots of its cluster.
const { buildCluster } = await import("../src/features/cluster/model/build.ts");
const { configFromJson } = await import("../src/features/cluster/model/url.ts");
const { phaseCoverage } = await import("../src/features/deployments/bom/coverage.ts");
const [saved] = await sql`select cluster_config, cluster_copies from deployment_phases where id = ${phase.id}`;
const config = configFromJson(saved.cluster_config);
if (config) {
  const items = (
    await sql`
      select i.id, i.quantity::float8 as quantity, i.unit_usd::float8 as unit_usd, i.status,
             coalesce(json_agg(json_build_object('slotId', f.slot_id, 'unitsPerItem', f.units_per_item::float8))
               filter (where f.slot_id is not null), '[]') as fills
      from deployment_bom_items i left join deployment_bom_fills f on f.item_id = i.id
      where i.phase_id = ${phase.id}
      group by i.id`
  ).map((r) => ({ id: r.id, quantity: r.quantity, unitUsd: r.unit_usd, status: r.status, fills: r.fills }));
  const coverage = phaseCoverage(buildCluster(config), saved.cluster_copies, items);
  console.log(`[bom:import] ${deployment.name} ${phaseName}: ${money(coverage.totalUsd)} in use across ${items.length} lines.`);
  for (const row of coverage.slots) {
    if (row.status === "covered") continue;
    const note = row.slot.optional ? " (optional)" : "";
    console.log(`  ${row.status.padEnd(8)} ${row.slot.label}${note}: ${row.filled} of ${row.required}`);
  }
}

if (failed) process.exit(1);
