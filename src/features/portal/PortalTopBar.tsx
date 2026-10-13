"use client";

import type { ReactElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PortalIcon } from "./icons";
import { activeApp, parentHref, portalApps, roomIdIn, type NavAccess } from "./nav";
import type { SidebarRoom } from "./PortalSidebar";
import styles from "./topbar.module.css";

/**
 * The phone's title bar, standing in for the site header: the app you're in
 * (or the data room), a back button on pages deeper than the app's own, and
 * the account. ZRM and Capacity keep the back button in their record pane,
 * which switches records without waiting on the server.
 */
export function PortalTopBar({
  access,
  rooms,
}: {
  access: NavAccess;
  rooms: readonly SidebarRoom[] | null | undefined;
}): ReactElement {
  const pathname = usePathname() ?? "/portal";
  const apps = portalApps(access);
  const app = activeApp(pathname, apps);
  const roomId = roomIdIn(pathname);
  const room = roomId ? rooms?.find(({ id }) => id === roomId) : undefined;
  const back = app.id === "zrm" || app.id === "capacity" ? null : parentHref(pathname, apps);
  const title = roomId ? (room?.name ?? "Data room") : app.label;

  return (
    <header className={styles.bar}>
      {back ? (
        <Link href={back} className={styles.back} aria-label="Back">
          <PortalIcon name="back" className={styles.backIcon} />
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
      <p key={title} className={styles.title}>
        {title}
      </p>
      {/* Initials come from the `<html>` flags in CSS, as in PinnedHeader, so they never pop in at hydration. */}
      <Link href="/portal/settings" className={styles.avatar} aria-label="Account">
        <PortalIcon name="person" className={styles.avatarGlyph} />
      </Link>
    </header>
  );
}
