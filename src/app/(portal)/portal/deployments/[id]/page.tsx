import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import Link from "next/link";
import { io } from "next/cache";
import { notFound } from "next/navigation";
import { Icon } from "@/features/data-room/icons";
import { listFileNames } from "@/features/data-room/rooms";
import ui from "@/features/data-room/ui.module.css";
import { getBom } from "@/features/deployments/bom/bom";
import { BomOverview } from "@/features/deployments/bom/BomOverview";
import { QuotesApp } from "@/features/deployments/bom/QuotesApp";
import { getDeploymentFor } from "@/features/deployments/deployments";
import detail from "@/features/deployments/deployments.module.css";
import { DeploymentDetail } from "@/features/deployments/DeploymentDetail";
import { DeploymentTabPanel, DeploymentTabs, DeploymentTabSwitch, TabLink } from "@/features/deployments/DeploymentTabs";
import { DocumentViewer } from "@/features/deployments/DocumentViewer";
import { isDeploymentTab, tabHref } from "@/features/deployments/tabs";
import { todayIso } from "@/features/deployments/format";
import { ShareLink } from "@/features/deployments/ShareLink";
import { canOpenDoc, statusLabel } from "@/features/deployments/types";
import { loadViewer } from "@/features/deployments/view";
import { orLogIn } from "@/features/portal/mine";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { PageHeader } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";
import { presentationName } from "@/features/presentations/types";

export const metadata: Metadata = {
  title: "Deployment | ZODE",
  robots: { index: false, follow: false },
};

/**
 * One deployment, for every signed-in account, with its teaser and
 * presentation, each written out from it and viewable in place
 * (`?tab=teaser`, `?tab=presentation`); the ZODE team can edit it and
 * switch to its BOM tab (`?tab=bom`) and its Quotes tab
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
  const [bom, roomFiles] = viewer.team
    ? await Promise.all([
        getBom(deployment.id),
        deployment.dataRoomId ? listFileNames(deployment.dataRoomId) : Promise.resolve([]),
      ])
    : [null, []];
  const teaser = canOpenDoc(deployment, "teaser", viewer);
  const presentation = canOpenDoc(deployment, "presentation", viewer);

  return (
    <DeploymentTabs
      base={base}
      initial={bom || (tab === "presentation" && presentation) || (tab === "teaser" && teaser) ? tab : "summary"}
    >
      <div className={styles.page}>
        <PageHeader
          title={deployment.name}
          subtitle={[statusLabel(deployment.status), deployment.city ?? deployment.address?.split("\n")[0]]
            .filter(Boolean)
            .join(" · ")}
          tabs={bom ? <DeploymentTabSwitch /> : undefined}
          actions={
            <>
              {teaser ? (
                <TabLink tab="teaser" className={ui.squareButton} label="View teaser">
                  <Icon name="page" />
                </TabLink>
              ) : null}
              {presentation ? (
                <TabLink tab="presentation" className={ui.squareButton} label="View presentation">
                  <Icon name="slides" />
                </TabLink>
              ) : null}
              {viewer.team ? (
                <>
                  <ShareLink
                    deployment={{
                      id: deployment.id,
                      name: deployment.name,
                      access: deployment.access,
                      shareToken: deployment.shareToken,
                      docs: deployment.docs,
                    }}
                  />
                  <Link href={`${base}/edit`} className={ui.primary}>
                    <Icon name="pencil" />
                    Edit
                  </Link>
                </>
              ) : null}
            </>
          }
        />
        <DeploymentTabPanel tab="summary">
          <div className={detail.detail}>
            <DeploymentDetail deployment={deployment} today={todayIso()} />
          </div>
        </DeploymentTabPanel>
        {presentation ? (
          <DeploymentTabPanel tab="presentation" fill>
            <DocumentViewer
              doc="presentation"
              deployment={{ id: deployment.id, name: presentationName(deployment) }}
              today={todayIso()}
            />
          </DeploymentTabPanel>
        ) : null}
        {teaser ? (
          <DeploymentTabPanel tab="teaser" fill>
            <DocumentViewer doc="teaser" deployment={{ id: deployment.id, name: deployment.name }} today={todayIso()} />
          </DeploymentTabPanel>
        ) : null}
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
