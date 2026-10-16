import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { io } from "next/cache";
import { notFound } from "next/navigation";
import { getDeployment } from "@/features/deployments/deployments";
import { DeploymentDetail } from "@/features/deployments/DeploymentDetail";
import { todayIso } from "@/features/deployments/format";
import { loadViewer } from "@/features/deployments/view";
import { orLogIn } from "@/features/portal/mine";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { DeploymentTeasers } from "@/features/teasers/TeaserList";
import { listTeasersFor } from "@/features/teasers/teasers";

export const metadata: Metadata = {
  title: "Deployment | ZODE",
  robots: { index: false, follow: false },
};

/** A deployment's Summary tab, for every signed-in account, with its teasers for the ZODE team. */
export default function DeploymentPage({ params }: PageProps<"/portal/deployments/[id]">): ReactElement {
  return (
    <Suspense fallback={<PortalLoading header={false} nested />}>
      <Deployment params={params} />
    </Suspense>
  );
}

async function Deployment({ params }: Pick<PageProps<"/portal/deployments/[id]">, "params">): Promise<ReactElement> {
  const { id } = await params;
  const viewer = orLogIn(await loadViewer(), `/portal/deployments/${id}`);
  const deployment = await getDeployment(id);
  if (!deployment) notFound();
  await io();
  const teasers = viewer.team ? await listTeasersFor(deployment.id) : null;

  return (
    <>
      <DeploymentDetail deployment={deployment} today={todayIso()} />
      {teasers ? <DeploymentTeasers deploymentId={deployment.id} teasers={teasers} /> : null}
    </>
  );
}
