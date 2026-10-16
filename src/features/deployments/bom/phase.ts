import { DEFAULT_CLUSTER, NODE_SIZES, PLATFORMS, STORAGE_PER_NODE } from "@/features/cluster/model/catalog";
import type { ClusterConfig, PlatformId } from "@/features/cluster/model/types";
import type { Deployment, Phase } from "../types";

export interface PhaseCluster {
  config: ClusterConfig;
  copies: number;
  /** True when the phase has no saved config and this one is worked out from it. */
  derived: boolean;
}

const largestFitting = (nodes: number): { size: number; copies: number } => {
  const exact = [...NODE_SIZES].reverse().find((size) => nodes % size === 0);
  if (exact) return { size: exact, copies: nodes / exact };
  const size = [...NODE_SIZES].reverse().find((s) => s <= nodes) ?? NODE_SIZES[0];
  return { size, copies: Math.ceil(nodes / size) };
};

/**
 * The phase as cluster-builder clusters: its saved config, or one worked out
 * from its platform and nodes and the deployment's fabric, cooling and
 * storage. Null for a platform the builder has no rack for yet.
 */
export function phaseCluster(
  d: Pick<Deployment, "networking" | "cooling" | "storageTbPerNode">,
  phase: Pick<Phase, "platform" | "nodes" | "clusterConfig" | "clusterCopies">,
): PhaseCluster | null {
  if (!Object.hasOwn(PLATFORMS, phase.platform)) return null;
  if (phase.clusterConfig) return { config: phase.clusterConfig, copies: phase.clusterCopies, derived: false };
  const { size, copies } = largestFitting(Math.max(phase.nodes, 1));
  return {
    config: {
      ...DEFAULT_CLUSTER,
      platform: phase.platform as PlatformId,
      nodes: size,
      fabric: d.networking,
      density: d.cooling === "air" ? 4 : 8,
      storagePerNode: (STORAGE_PER_NODE as readonly number[]).includes(d.storageTbPerNode) ? d.storageTbPerNode : 0,
    },
    copies,
    derived: true,
  };
}

/** The phase in the cluster builder, with its BOM loaded for the ZODE team. */
export const phaseBuilderHref = (deploymentId: string, phaseId: string): string =>
  `/cluster-builder?deployment=${encodeURIComponent(deploymentId)}&phase=${encodeURIComponent(phaseId)}`;

export const phaseLabel = (phase: Pick<Phase, "name">, index: number): string => phase.name || `Phase ${index + 1}`;
