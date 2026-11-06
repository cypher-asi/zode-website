"use client";

import { useState, type ReactElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PortalIcon } from "./icons";
import { activeApp, activeHref, portalApps, RESOURCE_LINKS, roomIdIn, type NavAccess, type NavLink } from "./nav";
import { useExtraRef, useSlotsFilled } from "./PortalFrame";
import styles from "./sidebar.module.css";

export type SidebarRoom = { id: string; name: string };

/** Rooms on the Home sidebar; Data rooms lists them all. */
const RECENT_ROOMS = 5;

const ROOM_PLACEHOLDER_ROWS = 3;

/** `newTab` opens every link in a new tab, marked by an arrow up and out on hover. */
function Links({
  links,
  current,
  newTab = false,
}: {
  links: readonly NavLink[];
  current: string | null;
  newTab?: boolean;
}): ReactElement {
  return (
    <ul className={styles.links}>
      {links.map((link) => {
        const content = (
          <>
            <PortalIcon name={link.icon} className={styles.linkIcon} />
            <span className={styles.linkLabel}>{link.label}</span>
            {newTab ? (
              <svg className={styles.linkOut} viewBox="0 0 16 16" aria-hidden="true">
                <path d="M5.5 3.5h7v7M12.5 3.5l-9 9" />
              </svg>
            ) : null}
          </>
        );
        return (
          <li key={link.href}>
            {link.external || newTab ? (
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

/**
 * The panel beside the rail, for whichever app you're in: its pages, or for
 * Data rooms the rooms themselves, the open one marked. `rooms` is
 * `undefined` while the session's rooms load. Switching apps animates
 * (`data-motion`); a fresh page load doesn't.
 */
export function PortalSidebar({
  access,
  rooms,
}: {
  access: NavAccess;
  rooms: readonly SidebarRoom[] | null | undefined;
}): ReactElement {
  const pathname = usePathname() ?? "/portal";
  const extraRef = useExtraRef();
  const filled = useSlotsFilled();
  const app = activeApp(pathname, portalApps(access));
  const roomId = app.id === "rooms" ? roomIdIn(pathname) : null;
  const current = activeHref(
    pathname,
    app.links.map(({ href }) => href),
  );

  const [shown, setShown] = useState(app.id);
  const [moved, setMoved] = useState(false);
  if (shown !== app.id) {
    setMoved(true);
    setShown(app.id);
  }

  return (
    <aside className={styles.sidebar} aria-label={`${app.label} sidebar`} data-motion={moved ? "swap" : undefined}>
      <div className={styles.head}>
        <div className={styles.titleGroup}>
          <h2 key={app.id} className={styles.title}>
            {app.label}
          </h2>
        </div>
      </div>

      <div className={styles.content}>
        <div key={app.id} className={styles.body}>
          {app.id === "home" ? (
            <>
              <section className={styles.section} aria-label="Recent data rooms">
                <h3 className={styles.heading}>Recent data rooms</h3>
                <Rooms rooms={rooms && rooms.slice(0, RECENT_ROOMS)} current={null} />
              </section>
              <section className={styles.section} aria-label="Tools">
                <h3 className={styles.heading}>Tools</h3>
                <Links links={app.links} current={current} newTab />
              </section>
              <section className={styles.section} aria-label="Resources">
                <h3 className={styles.heading}>Resources</h3>
                <Links links={RESOURCE_LINKS} current={null} newTab />
              </section>
            </>
          ) : app.id === "rooms" ? (
            <Rooms rooms={rooms} current={roomId} />
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
