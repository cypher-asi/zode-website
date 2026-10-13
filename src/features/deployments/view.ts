import "server-only";
import { cacheLife } from "next/cache";
import { isTeam } from "@/features/account/admin";
import { getAccount } from "@/features/account/session";
import { listDeployments } from "./deployments";
import type { Deployment } from "./types";

/**
 * Whether the signed-in account is on the ZODE team, who add and edit
 * deployments, or `null` when signed out. Private, so it rides in the
 * session's prefetched App Shell and never in a server cache.
 */
export async function loadViewer(): Promise<{ team: boolean } | null> {
  "use cache: private";
  cacheLife("minutes");
  const account = await getAccount();
  if (!account) return null;
  return { team: await isTeam(account) };
}

/** Every deployment, or `null` when they couldn't be loaded. */
export function loadDeployments(): Promise<Deployment[] | null> {
  return listDeployments().catch((error: unknown) => {
    console.error("[deployments] failed to load", error);
    return null;
  });
}
