import type { Metadata } from "next";
import type { BuilderBom } from "@/features/cluster/BomPanel";
import { ClusterConfigurator } from "@/features/cluster/ClusterConfigurator";
import type { ClusterConfig } from "@/features/cluster/model/types";
import { configFromParams, writeConfigParams } from "@/features/cluster/model/url";
import { getBom } from "@/features/deployments/bom/bom";
import { phaseCluster, phaseLabel } from "@/features/deployments/bom/phase";
import { getDeployment } from "@/features/deployments/deployments";
import { loadViewer } from "@/features/deployments/view";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Cluster Builder | ZODE",
  description:
    "Design a GPU cluster rack by rack: GPU platform, rack density, InfiniBand or RoCE fabric and storage, in live 3D.",
};

export const instant = false;

/**
 * A deployment phase's cluster with its BOM loaded, when `deployment` and
 * `phase` name one and the viewer is on the ZODE team; anyone else gets the
 * plain builder. Config params in the link override the phase's own.
 */
async function loadBom(
  deploymentId: string | null,
  phaseId: string | null,
  params: URLSearchParams,
): Promise<{ bom: BuilderBom; config: ClusterConfig } | null> {
  if (!deploymentId || !phaseId) return null;
  if (!(await loadViewer())?.team) return null;
  const deployment = await getDeployment(deploymentId);
  const index = deployment?.phases.findIndex((phase) => phase.id === phaseId) ?? -1;
  if (!deployment || index < 0) return null;
  const phase = deployment.phases[index];
  const cluster = phaseCluster(deployment, phase);
  if (!cluster) return null;
  const bom = await getBom(deployment.id);
  const merged = new URLSearchParams();
  writeConfigParams(cluster.config, merged);
  for (const [key, value] of params) merged.set(key, value);
  return {
    config: configFromParams(merged),
    bom: {
      deploymentId: deployment.id,
      deploymentName: deployment.name,
      phaseId: phase.id,
      phaseLabel: phaseLabel(phase, index),
      phaseNodes: phase.nodes,
      savedConfig: cluster.derived ? null : cluster.config,
      copies: cluster.copies,
      items: bom.items.filter((item) => item.phaseId === phase.id),
      vendors: Object.fromEntries(bom.quotes.map((quote) => [quote.id, quote.vendor])),
    },
  };
}

/**
 * The cluster builder, a resource linked from the footer menu. Lives
 * outside the `(site)` group, like /buy-compute, so the 3D viewport can fill
 * the screen. The configuration is read from the query string so shared
 * links open on the same cluster.
 */
export default async function ClusterConfiguratorPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" && key !== "deployment" && key !== "phase") params.set(key, value);
  }
  const pick = (key: string) => (typeof raw[key] === "string" ? raw[key] : null);
  const loaded = await loadBom(pick("deployment"), pick("phase"), params);

  return (
    <main className={styles.page}>
      <ClusterConfigurator initialConfig={loaded?.config ?? configFromParams(params)} bom={loaded?.bom} />
    </main>
  );
}
