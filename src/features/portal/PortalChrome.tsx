import "server-only";
import type { ReactElement } from "react";
import { cacheLife } from "next/cache";
import { isTeam, isZodeAdmin } from "@/features/account/admin";
import { getAccount } from "@/features/account/session";
import { loadRoomNames } from "./data";
import type { NavAccess } from "./nav";
import { PortalNav } from "./PortalNav";
import { PortalSidebar, type SidebarRoom } from "./PortalSidebar";

/**
 * What the rail and sidebar show for this session: which apps, and the rooms.
 * Private, so it rides in the session's prefetched App Shell and never in a
 * server cache.
 */
async function loadChrome(): Promise<{ access: NavAccess; rooms: SidebarRoom[] | null }> {
  "use cache: private";
  cacheLife("minutes");
  const account = await getAccount();
  if (!account) return { access: { admin: false, team: false }, rooms: null };
  const [admin, team, rooms] = await Promise.all([
    isZodeAdmin(account),
    isTeam(account),
    loadRoomNames(account.userId),
  ]);
  return { access: { admin, team }, rooms };
}

/** The portal's rail and sidebar for the signed-in account. */
export async function PortalChrome(): Promise<ReactElement> {
  const { access, rooms } = await loadChrome();
  return (
    <>
      <PortalNav access={access} />
      <PortalSidebar access={access} rooms={rooms} />
    </>
  );
}
