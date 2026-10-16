import { Suspense, type ReactElement } from "react";
import Link from "next/link";
import { io } from "next/cache";
import ui from "@/features/data-room/ui.module.css";
import { orLogIn } from "@/features/portal/mine";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { Empty } from "@/features/portal/sections";
import { TabbedPageHeader, type HeaderTab } from "@/features/portal/TabbedPageHeader";
import { DeploymentList } from "./DeploymentList";
import { todayIso } from "./format";
import type { DeploymentStatus } from "./types";
import { loadDeployments, loadViewer } from "./view";

/** A status's deployments, or all of them. */
export type DeploymentScope = DeploymentStatus | "all";

const HREFS: Record<DeploymentScope, string> = {
  all: "/portal/deployments",
  active: "/portal/deployments/active",
  planned: "/portal/deployments/planned",
  completed: "/portal/deployments/completed",
};

const TABS: readonly HeaderTab[] = [
  { href: HREFS.all, label: "All", title: "Deployments", subtitle: "Every GPU deployment, planned to completed." },
  { href: HREFS.active, label: "Active", title: "Deployments", subtitle: "GPU deployments live and rolling out." },
  { href: HREFS.planned, label: "Planned", title: "Deployments", subtitle: "GPU deployments not yet under way." },
  { href: HREFS.completed, label: "Completed", title: "Deployments", subtitle: "GPU deployments fully delivered." },
];

const EMPTY: Record<DeploymentScope, string> = {
  active: "No active deployments right now.",
  planned: "No planned deployments right now.",
  completed: "No completed deployments yet.",
  all: "No deployments yet.",
};

/** The Deployments header, a tab per status and All, and for the ZODE team a way to add one. */
export function DeploymentsHeader(): ReactElement {
  return (
    <TabbedPageHeader
      tabs={TABS}
      label="Deployments"
      actions={
        <Suspense fallback={null}>
          <NewButton />
        </Suspense>
      }
    />
  );
}

/** The Deployments list, one status's or all of them, for every signed-in account. */
export function DeploymentsIndex({ scope }: { scope: DeploymentScope }): ReactElement {
  return (
    <Suspense fallback={<PortalLoading header={false} nested />}>
      <Deployments scope={scope} />
    </Suspense>
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
  const viewer = orLogIn(await loadViewer(), HREFS[scope]);
  const deployments = await loadDeployments(viewer);
  await io();
  const today = todayIso();
  if (deployments === null)
    return <Empty>Deployments couldn&apos;t be loaded right now. Please try again shortly.</Empty>;
  const shown = scope === "all" ? deployments : deployments.filter((d) => d.status === scope);
  return shown.length ? (
    <DeploymentList deployments={shown} today={today} />
  ) : (
    <Empty>
      {EMPTY[scope]}
      {scope !== "all" && deployments.length ? (
        <>
          {" "}
          <Link href={HREFS.all}>See all deployments</Link>.
        </>
      ) : null}
    </Empty>
  );
}
