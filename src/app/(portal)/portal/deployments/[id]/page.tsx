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
import { todayIso } from "@/features/deployments/format";
import { ShareLink } from "@/features/deployments/ShareLink";
import { statusLabel } from "@/features/deployments/types";
import { loadViewer } from "@/features/deployments/view";
import { orLogIn } from "@/features/portal/mine";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { PageHeader } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";

export const metadata: Metadata = {
  title: "Deployment | ZODE",
  robots: { index: false, follow: false },
};

/** One deployment, for every signed-in account, with its PDF; the ZODE team can edit it. */
export default function DeploymentPage({ params }: PageProps<"/portal/deployments/[id]">): ReactElement {
  return (
    <Suspense fallback={<PortalLoading />}>
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
  const bom = viewer.team ? await getBom(deployment.id) : null;

  return (
    <div className={styles.page}>
      <PageHeader
        title={deployment.name}
        subtitle={[statusLabel(deployment.status), deployment.city ?? deployment.address?.split("\n")[0]]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            <a href={`/api/deployments/${deployment.id}/pdf`} className={ui.button} download>
              Download PDF
            </a>
            {viewer.team ? (
              <>
                <ShareLink id={deployment.id} token={deployment.shareToken} />
                <Link href={`/portal/deployments/teasers/new?deployment=${deployment.id}`} className={ui.button}>
                  Create teaser
                </Link>
                <Link href={`/portal/deployments/${deployment.id}/edit`} className={ui.primary}>
                  Edit
                </Link>
              </>
            ) : null}
          </>
        }
      />
      <DeploymentDetail deployment={deployment} today={todayIso()} />
      {bom ? (
        <div className={detail.detail}>
          <BomOverview deployment={deployment} bom={bom} today={todayIso()} />
        </div>
      ) : null}
    </div>
  );
}
