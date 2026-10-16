import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { getDeployment, listDeployments } from "@/features/deployments/deployments";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { Empty, PageHeader } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";
import { draftFromDeployment } from "@/features/teasers/draft";
import { TeaserForm } from "@/features/teasers/TeaserForm";
import { DeploymentPicker } from "@/features/teasers/TeaserList";
import { requireTeam } from "@/features/zrm/access";

export const metadata: Metadata = {
  title: "New teaser | Deployments | ZODE",
  robots: { index: false, follow: false },
};

/** Where the ZODE team starts a teaser: pick a deployment, then edit what it prefills. */
export default function NewTeaserPage({ searchParams }: PageProps<"/portal/deployments/teasers/new">): ReactElement {
  return (
    <Suspense fallback={<PortalLoading />}>
      <NewTeaser searchParams={searchParams} />
    </Suspense>
  );
}

async function NewTeaser({
  searchParams,
}: Pick<PageProps<"/portal/deployments/teasers/new">, "searchParams">): Promise<ReactElement> {
  const { deployment: raw } = await searchParams;
  const deploymentId = typeof raw === "string" ? raw : null;
  const account = await requireTeam(
    `/portal/deployments/teasers/new${deploymentId ? `?deployment=${encodeURIComponent(deploymentId)}` : ""}`,
  );
  const deployment = deploymentId ? await getDeployment(deploymentId) : null;

  if (!deployment) {
    const deployments = await listDeployments();
    return (
      <div className={styles.page}>
        <PageHeader title="New teaser" subtitle="Pick the deployment it offers. Its figures fill the teaser, for you to edit." />
        {deployments.length ? <DeploymentPicker deployments={deployments} /> : <Empty>Add a deployment first.</Empty>}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="New teaser"
        subtitle={`Filled in from ${deployment.name}. Edit anything, then create it to preview and export the PDF.`}
      />
      <TeaserForm teaser={draftFromDeployment(deployment, { name: account.displayName, email: account.email })} />
    </div>
  );
}
