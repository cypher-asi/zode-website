import { buildCluster } from "@/features/cluster/model/build";
import { DEFAULT_CLUSTER, NODE_SIZES, PLATFORMS, STORAGE_PER_NODE } from "@/features/cluster/model/catalog";
import type { ClusterConfig, ClusterModel, PlatformId } from "@/features/cluster/model/types";
import type { ResolvedConfig } from "../config/catalog";
import { resolveConfig, type ConfigSource } from "../config/resolve";
import type { Phase } from "../types";
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

/** The phase in the cluster builder, with its BOM loaded for the ZODE team. */
export const phaseBuilderHref = (deploymentId: string, phaseId: string): string =>
  `/cluster-builder?deployment=${encodeURIComponent(deploymentId)}&phase=${encodeURIComponent(phaseId)}`;

export const phaseLabel = (phase: Pick<Phase, "name">, index: number): string => phase.name || `Phase ${index + 1}`;
