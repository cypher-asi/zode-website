import type { Metadata } from "next";
import type { ReactElement } from "react";
import Link from "next/link";
import { io } from "next/cache";
import { notFound } from "next/navigation";
import ui from "@/features/data-room/ui.module.css";
import { getDeployment } from "@/features/deployments/deployments";
import { DeploymentDetail } from "@/features/deployments/DeploymentDetail";
import { todayIso } from "@/features/deployments/format";
import { statusLabel } from "@/features/deployments/types";
import { loadViewer } from "@/features/deployments/view";
import { orLogIn } from "@/features/portal/mine";
import { PageHeader } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";

export const metadata: Metadata = {
  title: "Deployment | ZODE",
  robots: { index: false, follow: false },
};

/** One deployment, for every signed-in account, with its PDF; the ZODE team can edit it. */
export default async function DeploymentPage({ params }: PageProps<"/portal/deployments/[id]">): Promise<ReactElement> {
  const { id } = await params;
  const viewer = orLogIn(await loadViewer(), `/portal/deployments/${id}`);
  const deployment = await getDeployment(id);
  if (!deployment) notFound();
  await io();

  return (
    <div className={styles.page}>
      <PageHeader
        title={deployment.name}
        subtitle={[statusLabel(deployment.status), deployment.address?.split("\n")[0]].filter(Boolean).join(" · ")}
        actions={
          <>
            <a href={`/api/deployments/${deployment.id}/pdf`} className={ui.button} download>
              Download PDF
            </a>
            {viewer.team ? (
              <Link href={`/portal/deployments/${deployment.id}/edit`} className={ui.primary}>
                Edit
              </Link>
            ) : null}
          </>
        }
      />
      <DeploymentDetail deployment={deployment} today={todayIso()} />
    </div>
  );
}
