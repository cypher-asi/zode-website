import { Suspense, type ReactElement } from "react";
import Link from "next/link";
import { io } from "next/cache";
import ui from "@/features/data-room/ui.module.css";
import { orLogIn } from "@/features/portal/mine";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { Empty, PageHeader } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";
import { DeploymentList } from "./DeploymentList";
import { DeploymentTabs, type DeploymentScope } from "./DeploymentTabs";
import { todayIso } from "./format";
import { loadDeployments, loadViewer } from "./view";

const HREFS: Record<DeploymentScope, string> = { active: "/portal/deployments", all: "/portal/deployments/all" };

/** The Deployments list, active ones or all of them, for every signed-in account; the ZODE team can add one. */
export function DeploymentsIndex({ scope }: { scope: DeploymentScope }): ReactElement {
  return (
    <div className={styles.page}>
      <PageHeader
        title="Deployments"
        subtitle={
          scope === "active" ? "GPU deployments live and rolling out." : "Every GPU deployment, planned to completed."
        }
        tabs={<DeploymentTabs current={scope} />}
        actions={
          <Suspense fallback={null}>
            <NewButton />
          </Suspense>
        }
      />
      <Suspense fallback={<PortalLoading header={false} nested />}>
        <Deployments scope={scope} />
      </Suspense>
    </div>
  );
}

async function NewButton(): Promise<ReactElement | null> {
  const viewer = await loadViewer();
  return viewer?.team ? (
    <Link href="/portal/deployments/new" className={ui.primary}>
      New deployment
    </Link>
  ) : null;
}

async function Deployments({ scope }: { scope: DeploymentScope }): Promise<ReactElement> {
  orLogIn(await loadViewer(), HREFS[scope]);
  const deployments = await loadDeployments();
  await io();
  const today = todayIso();
  if (deployments === null)
    return <Empty>Deployments couldn&apos;t be loaded right now. Please try again shortly.</Empty>;
  const shown = scope === "active" ? deployments.filter((d) => d.status === "active") : deployments;
  return shown.length ? (
    <DeploymentList deployments={shown} today={today} />
  ) : (
    <Empty>
      {scope === "active" ? "No active deployments right now." : "No deployments yet."}
      {scope === "active" && deployments.length ? (
        <>
          {" "}
          <Link href="/portal/deployments/all">See all deployments</Link>.
        </>
      ) : null}
    </Empty>
  );
}
