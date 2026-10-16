"use client";

import { useState, type ReactElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PortalIcon } from "./icons";
import { activeApp, activeHref, portalApps, RESOURCE_LINKS, roomIdIn, type NavAccess, type NavLink } from "./nav";
import { useDockRef, useExtraRef, useSlotsFilled } from "./PortalFrame";
import styles from "./sidebar.module.css";

export type SidebarRoom = { id: string; name: string };

/** Rooms on the Home sidebar; Data rooms lists them all. */
const RECENT_ROOMS = 5;

const PLACEHOLDER_ROWS = 6;

const ROOM_PLACEHOLDER_ROWS = 3;

function Links({ links, current }: { links: readonly NavLink[]; current: string | null }): ReactElement {
  return (
    <ul className={styles.links}>
      {links.map((link) => {
        const content = (
          <>
            <PortalIcon name={link.icon} className={styles.linkIcon} />
            <span className={styles.linkLabel}>{link.label}</span>
          </>
        );
        return (
          <li key={link.href}>
            {link.external ? (
              <a href={link.href} target="_blank" rel="noreferrer noopener" className={styles.link}>
                {content}
              </a>
            ) : (
              /* The site's tools, e.g. the cluster builder's 3D bundle, aren't worth warming up from the portal. */
              <Link
                href={link.href}
                prefetch={link.href.startsWith("/portal") ? undefined : false}
                className={styles.link}
                aria-current={link.href === current ? "page" : undefined}
              >
                {content}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** `rooms` is `undefined` while they load, `null` when they couldn't be. */
function Rooms({
  rooms,
  current,
}: {
  rooms: readonly SidebarRoom[] | null | undefined;
  current: string | null;
}): ReactElement {
  if (rooms === undefined) {
    return (
      <div className={styles.placeholder} role="status" aria-label="Loading data rooms">
        {Array.from({ length: ROOM_PLACEHOLDER_ROWS }, (_, index) => (
          <span key={index} className={styles.placeholderRow} />
        ))}
      </div>
    );
  }
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
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Stands in for a room's file explorer until the room's page docks the real one. */
function ExplorerPlaceholder(): ReactElement {
  return (
    <div className={styles.placeholder} role="status" aria-label="Loading files">
      <span className={styles.placeholderSearch} />
      {Array.from({ length: PLACEHOLDER_ROWS }, (_, index) => (
        <span key={index} className={styles.placeholderRow} />
      ))}
    </div>
  );
}

/**
 * How the sidebar changed last: into a room (`down`, the crumb pushing the
 * head's border down), back out (`up`), or across apps (`swap`). None on first
 * paint, so a fresh page load doesn't animate.
 */
type Motion = "down" | "up" | "swap";

/**
 * The panel beside the rail, for whichever app you're in: its pages, or for
 * Data rooms the rooms themselves. Inside a room the page docks its file
 * explorer here, in place of the room list. `rooms` is `undefined` while
 * the session's rooms load.
 */
export function PortalSidebar({
  access,
  rooms,
}: {
  access: NavAccess;
  rooms: readonly SidebarRoom[] | null | undefined;
}): ReactElement {
  const pathname = usePathname() ?? "/portal";
  const dockRef = useDockRef();
  const extraRef = useExtraRef();
  const filled = useSlotsFilled();
  const app = activeApp(pathname, portalApps(access));
  const roomId = app.id === "rooms" ? roomIdIn(pathname) : null;
  const room = roomId ? rooms?.find(({ id }) => id === roomId) : undefined;
  const current = activeHref(
    pathname,
    app.links.map(({ href }) => href),
  );

  const view = roomId ? `room:${roomId}` : app.id;
  const [shown, setShown] = useState({ view, inRoom: roomId !== null });
  const [motion, setMotion] = useState<Motion | null>(null);
  if (shown.view !== view) {
    const inRoom = roomId !== null;
    setMotion(inRoom === shown.inRoom ? "swap" : inRoom ? "down" : "up");
    setShown({ view, inRoom });
  }

  return (
    <aside className={styles.sidebar} aria-label={`${app.label} sidebar`} data-motion={motion ?? undefined}>
      <div className={styles.head}>
        <div className={styles.titleGroup}>
          {roomId ? (
            <Link href="/portal/data-rooms" className={styles.crumb}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M10 3.5 5.5 8l4.5 4.5" />
              </svg>
              Data Rooms
            </Link>
          ) : null}
          <h2 key={view} className={styles.title}>
            {roomId ? (room?.name ?? "Data room") : app.label}
          </h2>
        </div>
      </div>

      <div className={styles.content}>
        <div ref={dockRef} className={styles.dock} data-filled={filled.dock || undefined} />

        <div key={roomId ? "room" : app.id} className={styles.body}>
          {roomId ? (
            <ExplorerPlaceholder />
          ) : app.id === "home" ? (
            <>
              <section className={styles.section} aria-label="Recent data rooms">
                <h3 className={styles.heading}>Recent data rooms</h3>
                <Rooms rooms={rooms && rooms.slice(0, RECENT_ROOMS)} current={null} />
              </section>
              <section className={styles.section} aria-label="Tools">
                <h3 className={styles.heading}>Tools</h3>
                <Links links={app.links} current={current} />
              </section>
              <section className={styles.section} aria-label="Resources">
                <h3 className={styles.heading}>Resources</h3>
                <Links links={RESOURCE_LINKS} current={null} />
              </section>
            </>
          ) : app.id === "rooms" ? (
            <Rooms rooms={rooms} current={null} />
          ) : (
            <>
              <Links links={app.links} current={current} />
              <div ref={extraRef} className={styles.extra} data-filled={filled.extra || undefined} />
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
