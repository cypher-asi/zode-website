import "server-only";
import type { ReactElement } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { isTeam, isZodeAdmin } from "@/features/account/admin";
import { getAccount } from "@/features/account/session";
import { roomsVersion } from "@/features/data-room/invites";
import { accountRoomsTag } from "@/features/data-room/rooms";
import { loadRoomNames } from "./data";
import type { NavAccess } from "./nav";
import { PortalNav } from "./PortalNav";
import { PortalSidebar, type SidebarRoom } from "./PortalSidebar";
import { PortalTopBar } from "./PortalTopBar";
import { RoomsWatcher } from "./RoomsWatcher";

/**
 * What the rail and sidebar show for this session: which apps, and the rooms.
 * Private, so it rides in the session's prefetched App Shell and never in a
 * server cache.
 */
async function loadChrome(): Promise<{ access: NavAccess; rooms: SidebarRoom[] | null; version: string | null }> {
  "use cache: private";
  cacheLife("minutes");
  const account = await getAccount();
  if (!account) return { access: { admin: false, team: false }, rooms: null, version: null };
  cacheTag(accountRoomsTag(account.userId));
  const [admin, team, rooms, version] = await Promise.all([
    isZodeAdmin(account),
    isTeam(account),
    loadRoomNames(account.userId),
    roomsVersion(account).catch((error: unknown) => {
      console.error("Failed to load the data rooms version", error);
      return null;
    }),
  ]);
  return { access: { admin, team }, rooms, version };
}

/** The portal's rail, sidebar and phone title bar for the signed-in account, kept current as rooms are shared. */
export async function PortalChrome(): Promise<ReactElement> {
  const { access, rooms, version } = await loadChrome();
  return (
    <>
      <PortalTopBar access={access} rooms={rooms} />
      <PortalNav access={access} />
      <PortalSidebar access={access} rooms={rooms} />
      {version ? <RoomsWatcher version={version} /> : null}
    </>
  );
}
