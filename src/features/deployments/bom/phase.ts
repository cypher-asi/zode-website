import { buildCluster } from "@/features/cluster/model/build";
import { DEFAULT_CLUSTER, NODE_SIZES, PLATFORMS, STORAGE_PER_NODE } from "@/features/cluster/model/catalog";
import type { ClusterConfig, ClusterModel, PlatformId } from "@/features/cluster/model/types";
import { SYSTEMS, type ResolvedConfig } from "../config/catalog";
import { resolveConfig, type ConfigSource } from "../config/resolve";
import { nodesForMw, type Phase } from "../types";
import { buildOptions, hgxSizing, rackScaleSizing, type Sizing } from "./sizing";

export interface PhaseCluster {
  config: ClusterConfig;
  copies: number;
  /** True when the phase has no saved split into clusters and this one is worked out from its nodes. */
  derived: boolean;
}

type PhaseSource = Pick<Phase, "platform" | "nodes" | "clusterConfig" | "clusterCopies" | "configOverrides">;

const largestFitting = (nodes: number): { size: number; copies: number } => {
  const exact = [...NODE_SIZES].reverse().find((size) => nodes % size === 0);
  if (exact) return { size: exact, copies: nodes / exact };
  const size = [...NODE_SIZES].reverse().find((s) => s <= nodes) ?? NODE_SIZES[0];
  return { size, copies: Math.ceil(nodes / size) };
};

/** The builder's cluster of `nodes` under configuration `c`, its rows `rowLength` racks long. */
export const clusterConfigOf = (c: ResolvedConfig, nodes: number, rowLength: number): ClusterConfig => ({
  platform: c.platform as PlatformId,
  nodes,
  density: c.density,
  fabric: c.networking,
  oversubscription: c.oversubscription,
  rackU: c.rackU,
  rowLength,
  storagePerNode: (STORAGE_PER_NODE as readonly number[]).includes(c.storageTbPerNode) ? c.storageTbPerNode : 0,
});

/**
 * The phase as cluster-builder clusters, built to its configuration. What the
 * builder saved for it only splits its nodes into clusters (their size and
 * how many) and sets their rows; the configuration sets everything else.
 * Null for a rack-scale platform, which the builder has no rack for.
 */
export function phaseCluster(d: ConfigSource, phase: PhaseSource): PhaseCluster | null {
  const c = resolveConfig(d, phase);
  if (!Object.hasOwn(PLATFORMS, c.platform)) return null;
  const saved = phase.clusterConfig;
  const split = saved ? { size: saved.nodes, copies: phase.clusterCopies } : largestFitting(Math.max(phase.nodes, 1));
  return {
    config: clusterConfigOf(c, split.size, saved?.rowLength ?? DEFAULT_CLUSTER.rowLength),
    copies: split.copies,
    derived: !saved,
  };
}

/** Everything the phase's BOM is checked against. */
export interface PhasePlan {
  config: ResolvedConfig;
  cluster: PhaseCluster | null;
  model: ClusterModel | null;
  sizing: Sizing;
}

export function phasePlan(d: ConfigSource, phase: PhaseSource): PhasePlan {
  const config = resolveConfig(d, phase);
  const cluster = phaseCluster(d, phase);
  if (!cluster) return { config, cluster, model: null, sizing: rackScaleSizing(phase.nodes, config) };
  const model = buildCluster(cluster.config, buildOptions(cluster.config, config));
  return { config, cluster, model, sizing: hgxSizing(model, config, cluster.copies) };
}

type DraftPhase = Pick<Phase, "platform" | "nodes" | "configOverrides">;

/**
 * The IT MW, to the hundredth, the phase's nodes draw with the network,
 * storage and management built for them. An HGX phase draws what the
 * builder's largest cluster it fills does per node, so the figure climbs
 * steadily with the nodes rather than with however they'd split.
 */
export function phaseMw(d: ConfigSource, phase: DraftPhase): number {
  if (phase.nodes <= 0) return 0;
  const c = resolveConfig(d, phase);
  let kw: number;
  if (!Object.hasOwn(PLATFORMS, c.platform)) kw = rackScaleSizing(phase.nodes, c).itKw;
  else {
    const size = [...NODE_SIZES].reverse().find((s) => s <= phase.nodes) ?? NODE_SIZES[0];
    const config = clusterConfigOf(c, size, DEFAULT_CLUSTER.rowLength);
    kw = (phase.nodes * buildCluster(config, buildOptions(config, c)).stats.itKw) / size;
  }
  return Math.round(kw / 10) / 100;
}

/**
 * The most nodes `mw` of IT powers in the phase, network, storage and
 * management included, rack-scale systems in whole racks: the inverse of
 * `phaseMw`, so a figure it rounded still fits.
 */
export function phaseNodesForMw(d: ConfigSource, phase: Omit<DraftPhase, "nodes">, mw: number): number {
  const step = SYSTEMS[phase.platform].nodesPerRack ?? 1;
  let nodes = nodesForMw(phase.platform, mw);
  for (let tries = 0; tries < 32 && nodes > 0; tries++) {
    const drawn = phaseMw(d, { ...phase, nodes });
    if (drawn <= mw) break;
    nodes = Math.max(0, Math.min(nodes - step, Math.floor((nodes * mw) / drawn / step) * step));
  }
  // A cluster size up draws less per node, so a few more can fit past one that doesn't.
  let most = nodes;
  for (let more = nodes + step; more <= nodes + 8 * step; more += step) {
    if (phaseMw(d, { ...phase, nodes: more }) <= mw) most = more;
  }
  return most;
}

/** The phase in the cluster builder, with its BOM loaded for the ZODE team. */
export const phaseBuilderHref = (deploymentId: string, phaseId: string): string =>
  `/cluster-builder?deployment=${encodeURIComponent(deploymentId)}&phase=${encodeURIComponent(phaseId)}`;

export const phaseLabel = (phase: Pick<Phase, "name">, index: number): string => phase.name || `Phase ${index + 1}`;
