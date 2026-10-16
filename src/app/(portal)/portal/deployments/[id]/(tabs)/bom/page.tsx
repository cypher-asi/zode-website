import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { io } from "next/cache";
import { notFound } from "next/navigation";
import { getBom } from "@/features/deployments/bom/bom";
import { BomOverview } from "@/features/deployments/bom/BomOverview";
import { getDeployment } from "@/features/deployments/deployments";
import detail from "@/features/deployments/deployments.module.css";
import { todayIso } from "@/features/deployments/format";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { requireTeam } from "@/features/zrm/access";

export const metadata: Metadata = {
  title: "BOM | Deployment | ZODE",
  robots: { index: false, follow: false },
};

/** A deployment's BOM tab: its quotes and how far they fill each phase's cluster. The ZODE team only. */
export default function DeploymentBomPage({ params }: PageProps<"/portal/deployments/[id]/bom">): ReactElement {
  return (
    <Suspense fallback={<PortalLoading header={false} nested />}>
      <DeploymentBom params={params} />
    </Suspense>
  );
}

async function DeploymentBom({ params }: Pick<PageProps<"/portal/deployments/[id]/bom">, "params">): Promise<ReactElement> {
  const { id } = await params;
  await requireTeam(`/portal/deployments/${id}/bom`);
  const deployment = await getDeployment(id);
  if (!deployment) notFound();
  await io();
  const bom = await getBom(deployment.id);

  return (
    <div className={detail.detail}>
      <BomOverview deployment={deployment} bom={bom} today={todayIso()} />
    </div>
  );
}
