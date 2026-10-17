import {
  FABRICS,
  GPUS_PER_NODE,
  KIND_LABELS,
  LAYER_OF,
  DEFAULT_PDU,
  NETWORK_RACK,
  PDU_RATINGS,
  PLATFORMS,
  RACK,
  RAILS,
  SUPPORT,
  mgmtServersFor,
  rackHeight,
  unitY,
  type PduId,
} from "./catalog";
import type {
  ClusterConfig,
  ClusterModel,
  FabricId,
  HostLink,
  PartKind,
  PartsRow,
  PlatformId,
  Rack,
  RackPart,
  Uplink,
} from "./types";

/*
 * Turns a configuration into racks, parts and fabric, after OD3N's quote
 * shape, rack builders and rail-optimized fat tree: compute racks of HGX
 * nodes over a coolant manifold, network racks bin-packed least-filled-first,
 * and rail r of every node in a scalable unit landing on the same leaf.
 */

/** Leaves come in 1, 2, 4 or 8 below a full scalable unit so the rails split evenly, then in whole units of eight. */
function roundLeaves(n: number): number {
  if (n <= 1) return 1;
  if (n <= 8) return [2, 4, 8].find((k) => k >= n)!;
  return Math.ceil(n / RAILS) * RAILS;
}

export interface FabricShape {
  leaves: number;
  spines: number;
  hostLinks: number;
  uplinks: number;
  /** Switch ports at the rail's speed. */
  ports: number;
}

/**
 * The two-tier rail-optimized fabric for `hostLinks` rails of `railGbps`
 * on switches of `switchPorts` 800G ports, `oversubscription` host links
 * per uplink on every leaf.
 */
export function fabricShape(hostLinks: number, railGbps: number, switchPorts: number, oversubscription: number): FabricShape {
  const ports = switchPorts * (800 / railGbps);
  const down = Math.floor((ports * oversubscription) / (oversubscription + 1));
  const leaves = roundLeaves(Math.ceil(hostLinks / down));
  if (leaves === 1) return { leaves, spines: 0, hostLinks, uplinks: 0, ports };
  const perLeaf = Math.ceil(hostLinks / leaves / oversubscription);
  const uplinks = perLeaf * leaves;
  const needed = Math.max(2, Math.ceil(uplinks / ports));
  // Prefer a spine count each leaf's uplinks split evenly across.
  let spines = needed + (needed % 2);
  for (let k = needed; k <= Math.min(perLeaf, 2 * needed); k++) {
    if (perLeaf % k === 0) {
      spines = k;
      break;
    }
  }
  return { leaves, spines, hostLinks, uplinks, ports };
}

interface Item {
  kind: PartKind;
  model: string;
  uSize: number;
  kw: number;
  specs: [string, string][];
}

const repeat = (n: number, item: Item): Item[] => Array.from({ length: n }, () => item);

/** Front-end and storage switches, in MLAG pairs, for `ports` server ports. */
export const storageSwitchesFor = (ports: number): number => 2 * Math.ceil(ports / (SUPPORT.storageSwitch.ports - 16));

/** 1G out-of-band switches for `devices` management ports. */
export const oobSwitchesFor = (devices: number): number => Math.max(1, Math.ceil(devices / (SUPPORT.oob.ports - 4)));

/** Counts a deployment's configuration sets instead of the builder's own sizing. */
export interface BuildOptions {
  mgmtServers?: number;
  storageNodes?: number;
  fabricManagers?: number;
  firewalls?: number;
  pdu?: PduId;
  /** Whether every rack has A and B feeds (2N), as by default, or the one. */
  dualFeed?: boolean;
}

/** Power cords a part of `kind` plugs into its rack's PDUs, across both feeds. */
export function cordsOf(kind: PartKind, platform: PlatformId, fabric: FabricId): number {
  if (kind === "gpu") return PLATFORMS[platform].bill.powerCords;
  if (kind === "leaf" || kind === "spine") return FABRICS[fabric].compute.psus;
  if (kind === "storageSwitch") return SUPPORT.storageSwitch.psus;
  if (kind === "manifold" || kind === "panel") return 0;
  return 2;
}

/**
 * The rack PDUs one feed needs in a cabinet drawing `kw` through `cords`
 * power cords: enough to carry the whole cabinet alone, since under 2N either
 * feed takes it all when the other fails, and outlets for its share of the
 * cords (half with two feeds, all of them on one).
 */
export function pdusPerFeed(kw: number, cords: number, pdu: PduId, dualFeed: boolean): number {
  const rating = PDU_RATINGS[pdu];
  const feedCords = dualFeed ? Math.ceil(cords / 2) : cords;
  return Math.max(1, Math.ceil(kw / rating.kw - 1e-9), Math.ceil(feedCords / rating.outlets));
}

interface Counts {
  nas: number;
  mgmt: number;
  ufm: number;
  firewalls: number;
}

function computeRack(config: ClusterConfig, index: number, first: number, count: number): Rack {
  const platform = PLATFORMS[config.platform];
  const id = `c${index + 1}`;
  const parts: RackPart[] = (["supply", "return"] as const).map((flow, i) => ({
    id: `${id}-manifold-${flow}`,
    kind: "manifold",
    label: `Coolant manifold, ${flow}`,
    model: "1U rack manifold",
    uStart: 2 + i,
    uSize: 1,
    kw: 0,
    specs: [
      ["Loop", `Cabinet ${flow} riser off the secondary loop`],
      ["Ports", "One dripless quick-disconnect per node"],
    ],
  }));
  let u = 4;
  for (let k = 0; k < count; k++) {
    const n = first + k + 1;
    parts.push({
      id: `${id}-n${k + 1}`,
      kind: "gpu",
      label: `GPU node ${n}`,
      model: platform.label,
      uStart: u,
      uSize: platform.nodeU,
      kw: platform.nodeKw,
      specs: [
        ["GPUs", `${GPUS_PER_NODE} x ${platform.gpu}, ${platform.gpuMemoryGb} GB each`],
        ["Fabric", `${platform.nic}, one per rail`],
        ["CPUs", platform.cpu],
        ["Cooling", "Direct-to-chip liquid"],
      ],
    });
    u += platform.nodeU;
  }
  parts.push({
    id: `${id}-panel`,
    kind: "panel",
    label: "Fiber patch panel",
    model: "1U MPO-16 panel",
    uStart: u,
    uSize: 1,
    kw: 0,
    specs: [["Use", "Rail fiber from every node to the leaves"]],
  });
  return {
    id,
    name: `Compute rack ${index + 1}`,
    kind: "compute",
    uHeight: config.rackU,
    row: 0,
    slot: 0,
    x: 0,
    z: 0,
    facing: 1,
    parts,
    kw: parts.reduce((sum, p) => sum + p.kw, 0),
    usedU: u,
    pdusPerFeed: 0,
    feeds: 2,
  };
}

/** Network-rack contents in packing order, spines first so they spread across the racks. */
function networkItems(config: ClusterConfig, shape: FabricShape, oob: number, { nas, mgmt, ufm, firewalls }: Counts): Item[] {
  const fabric = FABRICS[config.fabric];
  const sw = fabric.compute;
  const platform = PLATFORMS[config.platform];
  const storageSwitches = storageSwitchesFor(config.nodes + nas * 4 + mgmt);
  const speed = `${platform.railGbps}G`;
  const ratio = config.oversubscription === 1 ? "non-blocking" : `${config.oversubscription}:1`;
  return [
    ...repeat(shape.spines, {
      kind: "spine",
      model: sw.model,
      uSize: sw.uSize,
      kw: sw.kw,
      specs: [
        ["Fabric", `${fabric.label} compute, spine`],
        ["Ports", `${shape.ports} x ${speed}, all down to leaves`],
      ],
    }),
    ...repeat(shape.leaves, {
      kind: "leaf",
      model: sw.model,
      uSize: sw.uSize,
      kw: sw.kw,
      specs: [
        ["Fabric", `${fabric.label} compute, rail-optimized leaf`],
        ["Ports", `${shape.ports} x ${speed}, ${ratio}`],
      ],
    }),
    ...repeat(storageSwitches, {
      kind: "storageSwitch",
      model: SUPPORT.storageSwitch.model,
      uSize: SUPPORT.storageSwitch.uSize,
      kw: SUPPORT.storageSwitch.kw,
      specs: [
        ["Network", "Storage and front-end, 400G"],
        ["Pairing", "MLAG pair"],
      ],
    }),
    ...repeat(oob, {
      kind: "oob",
      model: SUPPORT.oob.model,
      uSize: SUPPORT.oob.uSize,
      kw: SUPPORT.oob.kw,
      specs: [["Network", "Out-of-band management, 1G"]],
    }),
    ...repeat(2, {
      kind: "edge",
      model: SUPPORT.edge.model,
      uSize: SUPPORT.edge.uSize,
      kw: SUPPORT.edge.kw,
      specs: [["Role", "WAN uplinks, HA pair"]],
    }),
    ...repeat(firewalls, {
      kind: "firewall",
      model: SUPPORT.firewall.model,
      uSize: SUPPORT.firewall.uSize,
      kw: SUPPORT.firewall.kw,
      specs: [["Role", "Perimeter security, HA pair"]],
    }),
    ...repeat(ufm, {
      kind: "ufm",
      model: SUPPORT.ufm.model,
      uSize: SUPPORT.ufm.uSize,
      kw: SUPPORT.ufm.kw,
      specs: [["Role", "InfiniBand subnet manager and telemetry, HA pair"]],
    }),
    ...repeat(nas, {
      kind: "nas",
      model: SUPPORT.nas.model,
      uSize: SUPPORT.nas.uSize,
      kw: SUPPORT.nas.kw,
      specs: [
        ["Capacity", `${SUPPORT.nas.usableTb} TB usable`],
        ["Role", "Shared datasets, checkpoints and home directories"],
      ],
    }),
    ...repeat(mgmt, {
      kind: "mgmt",
      model: SUPPORT.mgmt.model,
      uSize: SUPPORT.mgmt.uSize,
      kw: SUPPORT.mgmt.kw,
      specs: [["Role", "Head, login, provisioning and monitoring"]],
    }),
  ];
}

/** Least-filled-first packing into `count` racks; null when something doesn't fit. */
function pack(config: ClusterConfig, items: Item[], count: number): Rack[] | null {
  const top = config.rackU - NETWORK_RACK.reservedTopU;
  const racks: Rack[] = Array.from({ length: count }, (_, i) => {
    const id = `n${i + 1}`;
    return {
      id,
      name: `Network rack ${i + 1}`,
      kind: "network",
      uHeight: config.rackU,
      row: 0,
      slot: 0,
      x: 0,
      z: 0,
      facing: 1,
      parts: [
        {
          id: `${id}-panel`,
          kind: "panel",
          label: "Fiber patch panel",
          model: "1U MPO-16 panel",
          uStart: 2,
          uSize: 1,
          kw: 0,
          specs: [["Use", "Rail and uplink fiber"]],
        },
      ],
      kw: 0,
      usedU: 3,
      pdusPerFeed: 0,
      feeds: 2,
    };
  });
  const counters = new Map<PartKind, number>();
  for (const item of items) {
    const fit = racks
      .filter((r) => r.usedU + item.uSize - 1 <= top && r.kw + item.kw <= NETWORK_RACK.maxKw)
      .sort((a, b) => a.usedU - b.usedU || a.kw - b.kw)[0];
    if (!fit) return null;
    const n = (counters.get(item.kind) ?? 0) + 1;
    counters.set(item.kind, n);
    fit.parts.push({
      id: `${item.kind}-${n}`,
      kind: item.kind,
      label: `${KIND_LABELS[item.kind]} ${n}`,
      model: item.model,
      uStart: fit.usedU,
      uSize: item.uSize,
      kw: item.kw,
      specs: item.specs,
    });
    fit.usedU += item.uSize;
    fit.kw += item.kw;
  }
  return racks;
}

/** Packs the network racks, growing the out-of-band network with the rack count until both settle. */
function networkRacks(config: ClusterConfig, shape: FabricShape, computeRacks: number, counts: Counts) {
  const switches = shape.leaves + shape.spines;
  for (let count = 1; count < 64; count++) {
    const pdus = (computeRacks + count) * 2;
    const devices = config.nodes + switches + counts.nas + counts.mgmt + pdus + 8;
    const racks = pack(config, networkItems(config, shape, oobSwitchesFor(devices), counts), count);
    if (racks) return racks;
  }
  throw new Error("network racks did not converge");
}

/**
 * Rows of up to `rowLength` cabinets, network racks in the middle of the run
 * so the fabric's longest cables stay short. Rows pair up back to back over a
 * hot aisle, with a cold aisle between pairs.
 */
function layout(config: ClusterConfig, compute: Rack[], network: Rack[]): { racks: Rack[]; rows: number } {
  const mid = Math.floor(compute.length / 2);
  const order = [...compute.slice(0, mid), ...network, ...compute.slice(mid)];
  const rows = Math.ceil(order.length / config.rowLength);
  const zs: number[] = [];
  let z = 0;
  for (let r = 0; r < rows; r++) {
    zs.push(z);
    z -= RACK.depth + (r % 2 === 0 ? RACK.hotAisle : RACK.coldAisle);
  }
  const zMid = (zs[0] + zs[zs.length - 1]) / 2;
  const longest = Math.min(order.length, config.rowLength);
  order.forEach((rack, i) => {
    rack.row = Math.floor(i / config.rowLength);
    rack.slot = i % config.rowLength;
    rack.x = (rack.slot - (longest - 1) / 2) * RACK.width;
    rack.z = zs[rack.row] - zMid;
    rack.facing = rack.row % 2 === 0 ? 1 : -1;
  });
  return { racks: order, rows };
}

/** Rail-optimized plan: rail r of node n lands on leaf `su * 8 + r` of the node's scalable unit. */
function railLinks(nodes: { rack: Rack; part: RackPart }[], leaves: { rack: Rack; part: RackPart }[]): HostLink[] {
  const suCount = Math.max(1, Math.floor(leaves.length / RAILS));
  const suSize = Math.ceil(nodes.length / suCount);
  const links: HostLink[] = [];
  nodes.forEach(({ rack, part }, n) => {
    const su = Math.min(suCount - 1, Math.floor(n / suSize));
    for (let rail = 0; rail < RAILS; rail++) {
      const leaf = leaves[(su * RAILS + rail) % leaves.length];
      links.push({ rail, rackId: rack.id, partId: part.id, leafRackId: leaf.rack.id, leafId: leaf.part.id });
    }
  });
  return links;
}

const partsOf = (racks: Rack[], kind: PartKind) =>
  racks.flatMap((rack) => rack.parts.filter((p) => p.kind === kind).map((part) => ({ rack, part })));

/** Twin-port switch optics: two links each, a rail landing on a leaf and an uplink at both its ends. */
export const switchOptics = (hostLinks: number, uplinks: number): number => Math.ceil((hostLinks + 2 * uplinks) / 2);

/** Cable run between two cabinets: up to the tray, along it and back down, plus slack. */
function runLength(a: Rack, b: Rack, trayY: number): number {
  return Math.abs(a.x - b.x) + Math.abs(a.z - b.z) + 2 * (trayY - 1) + 3;
}

export function buildCluster(config: ClusterConfig, options: BuildOptions = {}): ClusterModel {
  const platform = PLATFORMS[config.platform];
  const fabric = FABRICS[config.fabric];
  const shape = fabricShape(config.nodes * RAILS, platform.railGbps, fabric.compute.ports, config.oversubscription);
  const storageTb = config.nodes * config.storagePerNode;
  const nas = options.storageNodes ?? (storageTb ? Math.max(2, Math.ceil(storageTb / SUPPORT.nas.usableTb)) : 0);
  const counts: Counts = {
    nas,
    mgmt: options.mgmtServers ?? mgmtServersFor(config.nodes),
    ufm: options.fabricManagers ?? (fabric.fabricManager ? 2 : 0),
    firewalls: options.firewalls ?? 2,
  };

  const computeCount = Math.ceil(config.nodes / config.density);
  const compute = Array.from({ length: computeCount }, (_, i) =>
    computeRack(config, i, i * config.density, Math.min(config.density, config.nodes - i * config.density)),
  );
  const network = networkRacks(config, shape, computeCount, counts);
  const { racks, rows } = layout(config, compute, network);
  const pdu = options.pdu ?? DEFAULT_PDU;
  const dualFeed = options.dualFeed ?? true;
  for (const rack of racks) {
    const cords = rack.parts.reduce((sum, p) => sum + cordsOf(p.kind, config.platform, config.fabric), 0);
    rack.pdusPerFeed = pdusPerFeed(rack.kw, cords, pdu, dualFeed);
    rack.feeds = dualFeed ? 2 : 1;
  }
  const feedPdus = racks.reduce((sum, r) => sum + r.pdusPerFeed, 0);
  const byId = new Map(racks.map((r) => [r.id, r]));
  const trayY = rackHeight(config.rackU) + 0.45;

  // Layout keeps the compute racks in order, so the nodes already are; leaves were dealt across racks.
  const gpuNodes = partsOf(racks, "gpu");
  const seq = (p: RackPart) => Number(p.id.split("-").at(-1));
  const leaves = partsOf(racks, "leaf").sort((a, b) => seq(a.part) - seq(b.part));
  const spines = partsOf(racks, "spine").sort((a, b) => seq(a.part) - seq(b.part));
  const hostLinks = railLinks(gpuNodes, leaves);
  const uplinks: Uplink[] = [];
  if (spines.length) {
    const per = shape.uplinks / (leaves.length * spines.length);
    for (const leaf of leaves) {
      for (const spine of spines) {
        uplinks.push({
          leafRackId: leaf.rack.id,
          leafId: leaf.part.id,
          spineRackId: spine.rack.id,
          spineId: spine.part.id,
          count: per,
        });
      }
    }
  }

  const fiberM =
    hostLinks.reduce((sum, l) => sum + runLength(byId.get(l.rackId)!, byId.get(l.leafRackId)!, trayY), 0) +
    uplinks.reduce((sum, l) => sum + l.count * runLength(byId.get(l.leafRackId)!, byId.get(l.spineRackId)!, trayY), 0);

  const count = (kind: PartKind) => racks.reduce((n, r) => n + r.parts.filter((p) => p.kind === kind).length, 0);
  const gpus = config.nodes * GPUS_PER_NODE;
  const xs = racks.map((r) => r.x);
  const zs = racks.map((r) => r.z);
  const footprint =
    (Math.max(...xs) - Math.min(...xs) + RACK.width) * (Math.max(...zs) - Math.min(...zs) + RACK.depth + 2 * RACK.coldAisle);

  const switches = ["leaf", "spine", "storageSwitch", "oob"].reduce((n, k) => n + count(k as PartKind), 0);
  const hostLinkCount = shape.hostLinks;
  const uplinkCount = shape.uplinks;

  const row = (kind: PartKind, model: string, detail?: string): PartsRow => ({
    layer: LAYER_OF[kind],
    label: KIND_LABELS[kind],
    model,
    qty: count(kind),
    detail,
  });
  const speed = `${platform.railGbps}G`;
  const allParts: PartsRow[] = [
    row("gpu", platform.label, `${gpus.toLocaleString("en-US")} GPUs`),
    row("leaf", fabric.compute.model, `${fabric.label}, ${speed}`),
    row("spine", fabric.compute.model, `${fabric.label}, ${speed}`),
    row("storageSwitch", SUPPORT.storageSwitch.model, "400G"),
    row("oob", SUPPORT.oob.model, "1G"),
    row("edge", SUPPORT.edge.model, "HA pair"),
    row("firewall", SUPPORT.firewall.model, "HA pair"),
    row("ufm", SUPPORT.ufm.model, "HA pair"),
    row("nas", SUPPORT.nas.model, storageTb ? `${storageTb.toLocaleString("en-US")} TB requested` : undefined),
    row("mgmt", SUPPORT.mgmt.model),
    {
      layer: "rack",
      label: "Cabinet",
      model: `${config.rackU}U 800 x 1200 mm`,
      qty: racks.length,
      detail: `${computeCount} compute, ${network.length} network`,
    },
    {
      layer: "rack",
      label: "Rack PDU",
      model: `Switched, ${PDU_RATINGS[pdu].label}`,
      qty: feedPdus * (dualFeed ? 2 : 1),
      detail: dualFeed ? `${feedPdus.toLocaleString("en-US")} each on the A and B feeds` : "Single feed",
    },
    row("manifold", "1U rack manifold", "Supply and return"),
    row("panel", "1U MPO-16 panel"),
    {
      layer: "rack",
      label: "Rail cable",
      model: `${speed} fiber`,
      qty: hostLinkCount,
      detail: "Node to leaf",
    },
    { layer: "rack", label: "Uplink cable", model: `${speed} fiber`, qty: uplinkCount, detail: "Leaf to spine" },
    {
      layer: "rack",
      label: "Node transceiver",
      model: `${speed} OSFP, single port`,
      qty: hostLinkCount,
      detail: "One per rail",
    },
    {
      layer: "rack",
      label: "Switch transceiver",
      model: `2 x ${speed} OSFP, twin port`,
      qty: switchOptics(hostLinkCount, uplinkCount),
      detail: "Leaf down and up, spine down",
    },
  ];
  const parts = allParts.filter((p) => p.qty > 0);

  return {
    config,
    racks,
    hostLinks,
    uplinks,
    trayY,
    parts,
    stats: {
      nodes: config.nodes,
      gpus,
      racks: racks.length,
      computeRacks: computeCount,
      networkRacks: network.length,
      rows,
      itKw: racks.reduce((sum, r) => sum + r.kw, 0),
      gpuMemoryTb: (gpus * platform.gpuMemoryGb) / 1000,
      fp4Exaflops: (gpus * platform.fp4Pflops) / 1000,
      fabricTbps: (gpus * platform.railGbps) / 1000,
      railGbps: platform.railGbps,
      storageTb: nas * SUPPORT.nas.usableTb,
      leaves: shape.leaves,
      spines: shape.spines,
      switches,
      hostLinks: hostLinkCount,
      uplinks: uplinkCount,
      optics: hostLinkCount + switchOptics(hostLinkCount, uplinkCount),
      fiberKm: fiberM / 1000,
      footprintM2: footprint,
    },
  };
}

/** Floor-to-top-of-part height of a rack unit range, for drawing. */
export const partSpan = (part: RackPart) => ({
  y0: unitY(part.uStart),
  y1: unitY(part.uStart + part.uSize),
});
