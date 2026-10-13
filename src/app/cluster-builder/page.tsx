import type { Metadata } from "next";
import { PinnedHeader } from "@/components/layout/PinnedHeader";
import { ClusterConfigurator } from "@/features/cluster/ClusterConfigurator";
import { configFromParams } from "@/features/cluster/model/url";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Cluster Builder | ZODE",
  description:
    "Design a GPU cluster rack by rack: GPU platform, rack density, InfiniBand or RoCE fabric and storage, in live 3D.",
};

export const instant = false;

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
    if (typeof value === "string") params.set(key, value);
  }

  return (
    <main className={styles.page}>
      <PinnedHeader showAction={false} />
      <ClusterConfigurator initialConfig={configFromParams(params)} />
    </main>
  );
}
