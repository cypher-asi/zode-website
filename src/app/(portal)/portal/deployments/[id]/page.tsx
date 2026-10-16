import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import Link from "next/link";
import { io } from "next/cache";
import { notFound } from "next/navigation";
import { listFileNames } from "@/features/data-room/rooms";
import ui from "@/features/data-room/ui.module.css";
import { getBom } from "@/features/deployments/bom/bom";
import { BomOverview } from "@/features/deployments/bom/BomOverview";
import { QuotesApp } from "@/features/deployments/bom/QuotesApp";
import { getDeploymentFor } from "@/features/deployments/deployments";
import detail from "@/features/deployments/deployments.module.css";
import { DeploymentDetail } from "@/features/deployments/DeploymentDetail";
import { DeploymentTabPanel, DeploymentTabs, DeploymentTabSwitch } from "@/features/deployments/DeploymentTabs";
import { isDeploymentTab, tabHref } from "@/features/deployments/tabs";
import { todayIso } from "@/features/deployments/format";
import { ShareLink } from "@/features/deployments/ShareLink";
import { statusLabel } from "@/features/deployments/types";
import { loadViewer } from "@/features/deployments/view";
import { orLogIn } from "@/features/portal/mine";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { PageHeader } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";
import { DeploymentPresentation } from "@/features/presentations/DeploymentPresentation";
import { getPresentationFor } from "@/features/presentations/presentations";
import { presentationPdfPath } from "@/features/presentations/types";
import { DeploymentTeasers } from "@/features/teasers/TeaserList";
import { listTeasersFor } from "@/features/teasers/teasers";

export const metadata: Metadata = {
  title: "Deployment | ZODE",
  robots: { index: false, follow: false },
};

/**
 * One deployment, for every signed-in account, with its PDF and any
 * presentation; the ZODE team can edit it, start or edit the presentation,
 * and switch to its BOM tab (`?tab=bom`) and its Quotes tab
 * (`?tab=quotes`, with `&quote=<id>` open).
 */
export default function DeploymentPage({ params, searchParams }: PageProps<"/portal/deployments/[id]">): ReactElement {
  return (
    <Suspense fallback={<PortalLoading />}>
      <Deployment params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Deployment({ params, searchParams }: PageProps<"/portal/deployments/[id]">): Promise<ReactElement> {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const base = `/portal/deployments/${id}`;
  const tab = isDeploymentTab(query.tab) ? query.tab : "summary";
  const quoteId = typeof query.quote === "string" ? query.quote : null;
  const viewer = orLogIn(
    await loadViewer(),
    tab === "quotes" && quoteId ? `${tabHref(base, tab)}&quote=${encodeURIComponent(quoteId)}` : tabHref(base, tab),
  );
  const deployment = await getDeploymentFor(id, viewer);
  if (!deployment) notFound();
  await io();
  const [presentation, [teasers, bom, roomFiles]] = await Promise.all([
    getPresentationFor(deployment.id),
    viewer.team
      ? Promise.all([
          listTeasersFor(deployment.id),
          getBom(deployment.id),
          deployment.dataRoomId ? listFileNames(deployment.dataRoomId) : Promise.resolve([]),
        ])
      : Promise.resolve([null, null, []] as const),
  ]);

  return (
    <DeploymentTabs base={base} initial={bom ? tab : "summary"}>
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
              {presentation ? (
                <a href={presentationPdfPath(deployment.id, true)} className={ui.button} download>
                  Download presentation
                </a>
              ) : null}
              {viewer.team ? (
                <>
                  <ShareLink
                    deployment={{
                      id: deployment.id,
                      name: deployment.name,
                      access: deployment.access,
                      shareToken: deployment.shareToken,
                    }}
                  />
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
          {viewer.team ? <DeploymentPresentation deploymentId={deployment.id} presentation={presentation} /> : null}
          {teasers ? <DeploymentTeasers deploymentId={deployment.id} teasers={teasers} /> : null}
        </DeploymentTabPanel>
        {bom ? (
          <>
            <DeploymentTabPanel tab="bom">
              <div className={detail.detail}>
                <BomOverview deployment={deployment} bom={bom} />
              </div>
            </DeploymentTabPanel>
            <DeploymentTabPanel tab="quotes">
              <QuotesApp
                deployment={deployment}
                bom={bom}
                roomFiles={[...roomFiles].sort((a, b) => a.name.localeCompare(b.name))}
                initialQuoteId={quoteId}
                today={todayIso()}
              />
            </DeploymentTabPanel>
          </>
        ) : null}
      </div>
    </DeploymentTabs>
  );
}
