import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { DeploymentForm } from "@/features/deployments/DeploymentForm";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { PageHeader } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";
import { requireTeam } from "@/features/zrm/access";

export const metadata: Metadata = {
  title: "New deployment | Deployments | ZODE",
  robots: { index: false, follow: false },
};

/** Where the ZODE team adds a GPU deployment. */
export default function NewDeploymentPage(): ReactElement {
  return (
    <div className={styles.page}>
      <PageHeader title="New deployment" subtitle="A GPU deployment, its rollout, commercial terms and credit." />
      <Suspense fallback={<PortalLoading header={false} nested />}>
        <NewDeployment />
      </Suspense>
    </div>
  );
}

async function NewDeployment(): Promise<ReactElement> {
  await requireTeam("/portal/deployments/new");
  return <DeploymentForm />;
}
