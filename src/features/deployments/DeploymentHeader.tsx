import type { ReactElement } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import ui from "@/features/data-room/ui.module.css";
import { orLogIn } from "@/features/portal/mine";
import { TabbedPageHeader, type HeaderTab } from "@/features/portal/TabbedPageHeader";
import { getDeployment } from "./deployments";
import { ShareLink } from "./ShareLink";
import { statusLabel } from "./types";
import { loadViewer } from "./view";

/**
 * A deployment's header over its Summary and BOM tabs. Everyone signed in
 * sees the summary; the BOM tab is the ZODE team's.
 */
export async function DeploymentHeader({ id }: { id: string }): Promise<ReactElement> {
  const viewer = orLogIn(await loadViewer(), `/portal/deployments/${id}`);
  const deployment = await getDeployment(id);
  if (!deployment) notFound();
  const base = `/portal/deployments/${deployment.id}`;

  const tabs: HeaderTab[] = [
    {
      href: base,
      label: "Summary",
      title: deployment.name,
      subtitle: [statusLabel(deployment.status), deployment.city ?? deployment.address?.split("\n")[0]]
        .filter(Boolean)
        .join(" · "),
      actions: (
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
      ),
    },
    {
      href: `${base}/bom`,
      label: "BOM",
      title: deployment.name,
      subtitle: "Bill of materials: vendor quotes and the cluster slots each phase fills. Only the ZODE team sees this.",
    },
  ];

  return <TabbedPageHeader tabs={viewer.team ? tabs : tabs.slice(0, 1)} label="Deployment" showTabs={viewer.team} />;
}
