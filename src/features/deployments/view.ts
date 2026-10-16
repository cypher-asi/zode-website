import "server-only";
import { cacheLife } from "next/cache";
import { isTeam } from "@/features/account/admin";
import { getAccount } from "@/features/account/session";
import { listDeployments } from "./deployments";
import { canOpen, type Deployment, type DeploymentViewer } from "./types";

/**
 * The signed-in account and whether it's on the ZODE team, who add and edit
 * deployments, or `null` when signed out. Private, so it rides in the
 * session's prefetched App Shell and never in a server cache.
 */
export async function loadViewer(): Promise<DeploymentViewer | null> {
  "use cache: private";
  cacheLife("minutes");
  const account = await getAccount();
  if (!account) return null;
  return { team: await isTeam(account), userId: account.userId };
}

/** Every deployment `viewer` can open, or `null` when they couldn't be loaded. */
export function loadDeployments(viewer: DeploymentViewer): Promise<Deployment[] | null> {
  return listDeployments()
    .then((deployments) => deployments.filter((deployment) => canOpen(deployment, viewer)))
    .catch((error: unknown) => {
      console.error("[deployments] failed to load", error);
      return null;
    });
}
