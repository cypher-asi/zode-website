import {
  fabricShape,
  oobSwitchesFor,
  pdusPerFeed,
  storageSwitchesFor,
  type BuildOptions,
} from "@/features/cluster/model/build";
import { FABRICS, NETWORK_RACK, SUPPORT, mgmtServersFor } from "@/features/cluster/model/catalog";
import type { ClusterConfig, ClusterModel, PartKind } from "@/features/cluster/model/types";
import { STORAGE_PLATFORMS, SYSTEMS, type ResolvedConfig } from "../config/catalog";

/*
 * How much of everything one phase needs, worked out from its configuration:
 * from the cluster builder's racks for an HGX platform, and directly for a
 * rack-scale one, which the builder can't lay out. The BOM's slots
 * (./slots.ts) read their quantities from here.
 */

export interface Sizing {
  rackScale: boolean;
  nodes: number;
  gpus: number;
  /** Rack-scale racks (NVL72, NVL144), each a system that brings its own cabinet. */
  systemRacks: number;
  /** HGX compute racks, or the rack-scale racks. */
  computeRacks: number;
  networkRacks: number;
  /** Cabinets to buy: every rack but rack-scale systems. */
  cabinets: number;
  leaves: number;
  spines: number;
  hostLinks: number;
  uplinks: number;
  storageSwitches: number;
  /** A dedicated storage fabric's own switches, beside the front-end's. */
  storageFabricSwitches: number;
  oob: number;
  edge: number;
  firewalls: number;
  fabricManagers: number;
  storageNodes: number;
  mgmt: number;
  panels: number;
  manifolds: number;
  computeKw: number;
  itKw: number;
  /** Rack PDUs on one feed across every cabinet; a 2N phase has as many again on the other (see `pdusPerFeed`). */
  feedPdus: number;
}

/** Shared storage nodes for `nodes` GPU nodes of configuration `c`. */
export function storageNodesFor(c: ResolvedConfig, nodes: number): number {
  const tb = nodes * c.storageTbPerNode;
  if (!tb) return 0;
  const platform = STORAGE_PLATFORMS[c.storagePlatform];
  return Math.max(platform.minNodes, Math.ceil(tb / platform.usableTb));
}

/** Management servers for a cluster of `gpus`: as configured, or sized like the builder's for as many HGX nodes. */
const mgmtFor = (c: ResolvedConfig, gpus: number): number => c.mgmtNodes || mgmtServersFor(Math.ceil(gpus / 8));

const fabricManagersFor = (c: ResolvedConfig): number => (c.networking === "infiniband" && c.ufm !== "none" ? 2 : 0);

const firewallsFor = (c: ResolvedConfig): number => (c.firewall === "customer" ? 0 : 2);

/** What the builder draws of one cluster of `config` to match configuration `c`. */
export const buildOptions = (config: ClusterConfig, c: ResolvedConfig): BuildOptions => ({
  storageNodes: storageNodesFor(c, config.nodes),
  mgmtServers: mgmtFor(c, config.nodes * SYSTEMS[c.platform].gpusPerNode),
  fabricManagers: fabricManagersFor(c),
  firewalls: firewallsFor(c),
  pdu: c.pdu,
  dualFeed: c.power === "2n",
});

/** `copies` of the builder's cluster `model`, built with `buildOptions`, under configuration `c`. */
export function hgxSizing(model: ClusterModel, c: ResolvedConfig, copies: number): Sizing {
  const counts = new Map<PartKind, number>();
  for (const rack of model.racks) for (const part of rack.parts) counts.set(part.kind, (counts.get(part.kind) ?? 0) + 1);
  const n = (kind: PartKind) => (counts.get(kind) ?? 0) * copies;
  const x = (value: number) => value * copies;
  const liquid = c.cooling === "liquid_dtc";
  const computeKw = model.racks.filter((r) => r.kind === "compute").reduce((sum, r) => sum + r.kw, 0);
  return {
    rackScale: false,
    nodes: x(model.stats.nodes),
    gpus: x(model.stats.gpus),
    systemRacks: 0,
    computeRacks: x(model.stats.computeRacks),
    networkRacks: x(model.stats.networkRacks),
    cabinets: x(model.stats.racks),
    leaves: x(model.stats.leaves),
    spines: x(model.stats.spines),
    hostLinks: x(model.stats.hostLinks),
    uplinks: x(model.stats.uplinks),
    storageSwitches: n("storageSwitch"),
    storageFabricSwitches: c.storageNetwork === "dedicated" ? n("storageSwitch") : 0,
    oob: n("oob"),
    edge: n("edge"),
    firewalls: n("firewall"),
    fabricManagers: n("ufm"),
    storageNodes: n("nas"),
    mgmt: n("mgmt"),
    panels: n("panel"),
    manifolds: liquid ? n("manifold") : 0,
    computeKw: x(computeKw),
    itKw: x(model.stats.itKw),
    feedPdus: x(model.racks.reduce((sum, r) => sum + r.pdusPerFeed, 0)),
  };
}

/**
 * `nodes` compute trays of a rack-scale system under configuration `c`: whole
 * racks of trays on the same rail-optimized fabric the builder lays out, and
 * network racks packed by space and power like its own.
 */
export function rackScaleSizing(nodes: number, c: ResolvedConfig): Sizing {
  const system = SYSTEMS[c.platform];
  const sw = FABRICS[c.networking].compute;
  const gpus = nodes * system.gpusPerNode;
  const systemRacks = Math.ceil(nodes / (system.nodesPerRack ?? 1));
  const shape = fabricShape(nodes * system.nicsPerNode, system.railGbps, sw.ports, c.oversubscription);
  const storageNodes = storageNodesFor(c, nodes);
  const mgmt = mgmtFor(c, gpus);
  const fabricManagers = fabricManagersFor(c);
  const firewalls = firewallsFor(c);
  const edge = 2;
  const storageSwitches = storageSwitchesFor(nodes + storageNodes * 4 + mgmt);
  const storageFabricSwitches = c.storageNetwork === "dedicated" ? storageSwitches : 0;
  const switches = shape.leaves + shape.spines;

  // [count, U, kW] of everything in the network racks but the out-of-band switches.
  const items: [number, number, number][] = [
    [switches, sw.uSize, sw.kw],
    [storageSwitches + storageFabricSwitches, SUPPORT.storageSwitch.uSize, SUPPORT.storageSwitch.kw],
    [edge, SUPPORT.edge.uSize, SUPPORT.edge.kw],
    [firewalls, SUPPORT.firewall.uSize, SUPPORT.firewall.kw],
    [fabricManagers, SUPPORT.ufm.uSize, SUPPORT.ufm.kw],
    [storageNodes, SUPPORT.nas.uSize, SUPPORT.nas.kw],
    [mgmt, SUPPORT.mgmt.uSize, SUPPORT.mgmt.kw],
  ];
  const usableU = c.rackU - NETWORK_RACK.reservedTopU - 2;
  let networkRacks = 1;
  let oob = 1;
  for (let k = 0; k < 8; k++) {
    const devices =
      nodes +
      systemRacks * (system.switchTrays + system.powerShelves) +
      switches +
      storageSwitches +
      storageFabricSwitches +
      storageNodes +
      mgmt +
      networkRacks * 2 +
      8;
    oob = oobSwitchesFor(devices);
    const u = items.reduce((sum, [count, size]) => sum + count * size, 0) + oob * SUPPORT.oob.uSize;
    const kw = items.reduce((sum, [count, , each]) => sum + count * each, 0) + oob * SUPPORT.oob.kw;
    const next = Math.max(1, Math.ceil(u / usableU), Math.ceil(kw / NETWORK_RACK.maxKw));
    if (next === networkRacks) break;
    networkRacks = next;
  }
  const networkKw = items.reduce((sum, [count, , each]) => sum + count * each, 0) + oob * SUPPORT.oob.kw;
  const computeKw = nodes * system.nodeKw;
  // The systems' racks feed their power shelves straight from the floor; only the network racks take PDUs.
  const networkCords =
    switches * sw.psus +
    (storageSwitches + storageFabricSwitches) * SUPPORT.storageSwitch.psus +
    (edge + firewalls + fabricManagers + storageNodes + mgmt + oob) * 2;
  const feedPdus =
    networkRacks *
    pdusPerFeed(networkKw / networkRacks, Math.ceil(networkCords / networkRacks), c.pdu, c.power === "2n");

  return {
    rackScale: true,
    nodes,
    gpus,
    systemRacks,
    computeRacks: systemRacks,
    networkRacks,
    cabinets: networkRacks,
    leaves: shape.leaves,
    spines: shape.spines,
    hostLinks: shape.hostLinks,
    uplinks: shape.uplinks,
    storageSwitches,
    storageFabricSwitches,
    oob,
    edge,
    firewalls,
    fabricManagers,
    storageNodes,
    mgmt,
    panels: systemRacks + networkRacks,
    manifolds: 0,
    computeKw,
    itKw: computeKw + networkKw,
    feedPdus,
  };
}
