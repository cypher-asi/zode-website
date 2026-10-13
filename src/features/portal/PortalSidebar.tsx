"use client";

import type { ReactElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PortalIcon } from "./icons";
import { activeApp, activeHref, portalApps, roomIdIn, type CountKey, type NavAccess, type NavLink } from "./nav";
import { SidebarToggle, useDockRef } from "./PortalFrame";
import styles from "./sidebar.module.css";

export type SidebarRoom = { id: string; name: string; fileCount: number };

/** Rooms on the Home sidebar; Data rooms lists them all. */
const RECENT_ROOMS = 5;

function Count({ value }: { value: number | undefined }): ReactElement | null {
  return value === undefined ? null : <span className={styles.count}>{value.toLocaleString("en-US")}</span>;
}

function Links({
  links,
  current,
  counts,
}: {
  links: readonly NavLink[];
  current: string | null;
  counts: Partial<Record<CountKey, number>>;
}): ReactElement {
  return (
    <ul className={styles.links}>
      {links.map((link) => (
        <li key={link.href}>
          <Link href={link.href} className={styles.link} aria-current={link.href === current ? "page" : undefined}>
            <PortalIcon name={link.icon} className={styles.linkIcon} />
            <span className={styles.linkLabel}>{link.label}</span>
            <Count value={link.count ? counts[link.count] : undefined} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Rooms({ rooms, current }: { rooms: readonly SidebarRoom[] | null; current: string | null }): ReactElement {
  if (rooms === null) return <p className={styles.empty}>Your data rooms couldn&apos;t be loaded.</p>;
  if (!rooms.length) return <p className={styles.empty}>Data rooms shared with you appear here.</p>;
  return (
    <ul className={styles.links}>
      {rooms.map((room) => (
        <li key={room.id}>
          <Link
            href={`/portal/data-rooms/${room.id}`}
            className={styles.link}
            aria-current={room.id === current ? "page" : undefined}
          >
            <PortalIcon name="rooms" className={styles.linkIcon} />
            <span className={styles.linkLabel}>{room.name}</span>
            <Count value={room.fileCount} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * The panel beside the rail, for whichever app you're in: its pages, or for
 * Data rooms the rooms themselves. Inside a room the page docks its file
 * explorer here, in place of the room list.
 */
export function PortalSidebar({
  access,
  counts,
  rooms,
}: {
  access: NavAccess;
  counts: Partial<Record<CountKey, number>>;
  rooms: readonly SidebarRoom[] | null;
}): ReactElement {
  const pathname = usePathname() ?? "/portal";
  const dockRef = useDockRef();
  const app = activeApp(pathname, portalApps(access));
  const roomId = app.id === "rooms" ? roomIdIn(pathname) : null;
  const room = roomId ? rooms?.find(({ id }) => id === roomId) : undefined;
  const current = activeHref(
    pathname,
    app.links.map(({ href }) => href),
  );

  return (
    <aside className={styles.sidebar} aria-label={`${app.label} sidebar`}>
      <div className={styles.head}>
        {roomId ? (
          <div className={styles.titleGroup}>
            <Link href="/portal/data-rooms" className={styles.crumb}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M10 3.5 5.5 8l4.5 4.5" />
              </svg>
              Data rooms
            </Link>
            <h2 className={styles.title}>{room?.name ?? "Data room"}</h2>
          </div>
        ) : (
          <h2 className={styles.title}>{app.label}</h2>
        )}
        <SidebarToggle placement="sidebar" className={styles.toggle} />
      </div>

      <div ref={dockRef} className={styles.dock} />

      <div className={styles.body}>
        {app.id === "home" ? (
          <>
            <section className={styles.section} aria-label="Recent data rooms">
              <h3 className={styles.heading}>Recent data rooms</h3>
              <Rooms rooms={rooms && rooms.slice(0, RECENT_ROOMS)} current={null} />
            </section>
            <section className={styles.section} aria-label="Tools">
              <h3 className={styles.heading}>Tools</h3>
              <Links links={app.links} current={current} counts={counts} />
            </section>
          </>
        ) : app.id === "rooms" ? (
          <Rooms rooms={rooms} current={roomId} />
        ) : (
          <Links links={app.links} current={current} counts={counts} />
        )}
      </div>
    </aside>
  );
}
