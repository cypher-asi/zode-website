import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import Link from "next/link";
import { io } from "next/cache";
import { notFound } from "next/navigation";
import ui from "@/features/data-room/ui.module.css";
import { getBom } from "@/features/deployments/bom/bom";
import { BomOverview } from "@/features/deployments/bom/BomOverview";
import { getDeployment } from "@/features/deployments/deployments";
import detail from "@/features/deployments/deployments.module.css";
import { DeploymentDetail } from "@/features/deployments/DeploymentDetail";
import { DeploymentTabPanel, DeploymentTabs, DeploymentTabSwitch } from "@/features/deployments/DeploymentTabs";
import { todayIso } from "@/features/deployments/format";
import { ShareLink } from "@/features/deployments/ShareLink";
import { statusLabel } from "@/features/deployments/types";
import { loadViewer } from "@/features/deployments/view";
import { orLogIn } from "@/features/portal/mine";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { PageHeader } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";
import { DeploymentTeasers } from "@/features/teasers/TeaserList";
import { listTeasersFor } from "@/features/teasers/teasers";

export const metadata: Metadata = {
  title: "Deployment | ZODE",
  robots: { index: false, follow: false },
};

/**
 * One deployment, for every signed-in account, with its PDF; the ZODE team can
 * edit it and switch to its BOM tab (`?tab=bom`).
 */
export default function DeploymentPage({ params, searchParams }: PageProps<"/portal/deployments/[id]">): ReactElement {
  return (
    <Suspense fallback={<PortalLoading />}>
      <Deployment params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Deployment({ params, searchParams }: PageProps<"/portal/deployments/[id]">): Promise<ReactElement> {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const base = `/portal/deployments/${id}`;
  const viewer = orLogIn(await loadViewer(), tab === "bom" ? `${base}?tab=bom` : base);
  const deployment = await getDeployment(id);
  if (!deployment) notFound();
  await io();
  const [teasers, bom] = viewer.team
    ? await Promise.all([listTeasersFor(deployment.id), getBom(deployment.id)])
    : [null, null];

  return (
    <DeploymentTabs base={base} initial={bom && tab === "bom" ? "bom" : "summary"}>
      <div className={styles.page}>
        <PageHeader
          title={deployment.name}
          subtitle={[statusLabel(deployment.status), deployment.city ?? deployment.address?.split("\n")[0]]
            .filter(Boolean)
            .join(" · ")}
          tabs={bom ? <DeploymentTabSwitch /> : undefined}
          actions={
            <>
              <a href={`/api/deployments/${deployment.id}/pdf`} className={ui.button} download>
                Download PDF
              </a>
              {viewer.team ? (
                <>
                  <ShareLink id={deployment.id} token={deployment.shareToken} />
                  <Link href={`${base}/edit`} className={ui.primary}>
                    Edit
                  </Link>
                </>
              ) : null}
            </>
          }
        />
        <DeploymentTabPanel tab="summary">
          <DeploymentDetail deployment={deployment} today={todayIso()} />
          {teasers ? <DeploymentTeasers deploymentId={deployment.id} teasers={teasers} /> : null}
        </DeploymentTabPanel>
        {bom ? (
          <DeploymentTabPanel tab="bom">
            <div className={detail.detail}>
              <BomOverview deployment={deployment} bom={bom} today={todayIso()} />
            </div>
          </DeploymentTabPanel>
        ) : null}
      </div>
    </DeploymentTabs>
  );
}
