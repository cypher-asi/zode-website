import "server-only";
import type { ReactElement } from "react";
import { cacheLife } from "next/cache";
import { isTeam, isZodeAdmin } from "@/features/account/admin";
import { getAccount } from "@/features/account/session";
import { loadRoomNames } from "./data";
import type { NavAccess } from "./nav";
import { PortalNav } from "./PortalNav";
import { PortalSidebar, type SidebarRoom } from "./PortalSidebar";
import { PortalTopBar } from "./PortalTopBar";

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

/** The portal's rail, sidebar and phone title bar for the signed-in account. */
export async function PortalChrome(): Promise<ReactElement> {
  const { access, rooms } = await loadChrome();
  return (
    <>
      <PortalTopBar access={access} rooms={rooms} />
      <PortalNav access={access} />
      <PortalSidebar access={access} rooms={rooms} />
    </>
  );
}
