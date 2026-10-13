import type { Metadata } from "next";
import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { getDeployment } from "@/features/deployments/deployments";
import { DeploymentForm } from "@/features/deployments/DeploymentForm";
import { PageHeader } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";
import { requireTeam } from "@/features/zrm/access";

export const metadata: Metadata = {
  title: "Edit deployment | Deployments | ZODE",
  robots: { index: false, follow: false },
};

/** Where the ZODE team edits or deletes a deployment. */
export default async function EditDeploymentPage({
  params,
}: PageProps<"/portal/deployments/[id]/edit">): Promise<ReactElement> {
  const { id } = await params;
  await requireTeam(`/portal/deployments/${id}/edit`);
  const deployment = await getDeployment(id);
  if (!deployment) notFound();

  return (
    <div className={styles.page}>
      <PageHeader title={`Edit ${deployment.name}`} subtitle="Changes show to everyone as soon as they're saved." />
      <DeploymentForm key={deployment.updatedAt} deployment={deployment} />
    </div>
  );
}
