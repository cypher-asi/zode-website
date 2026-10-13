"use client";

import type { ReactElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PortalIcon } from "./icons";
import { activeApp, portalApps, type NavAccess, type PortalApp } from "./nav";
import { SidebarToggle } from "./PortalFrame";
import styles from "./shell.module.css";

function RailItem({ app, current }: { app: PortalApp; current: boolean }): ReactElement {
  return (
    <Link href={app.href} className={styles.item} aria-current={current ? "page" : undefined}>
      <PortalIcon name={app.icon} className={styles.icon} />
      <span className={styles.tooltip}>{app.label}</span>
    </Link>
  );
}

/**
 * The portal's apps down a black bar in a frosted tray, with Settings and the
 * account in a tray of their own at the foot; the sidebar beside it lists
 * whichever app you're in. A bar along the bottom on phones.
 */
export function PortalNav({ access }: { access: NavAccess }): ReactElement {
  const pathname = usePathname() ?? "/portal";
  const apps = portalApps(access);
  const current = activeApp(pathname, apps);
  const settings = apps[apps.length - 1];

  return (
    <nav className={styles.rail} aria-label="Portal">
      <div className={styles.tray}>
        <div className={styles.bar}>
          <div className={styles.group}>
            {apps.slice(0, -1).map((app) => (
              <RailItem key={app.id} app={app} current={app.id === current.id} />
            ))}
          </div>
          <SidebarToggle
            placement="rail"
            className={`${styles.item} ${styles.railToggle}`}
            iconClassName={styles.icon}
            labelClassName={styles.tooltip}
          />
        </div>
        <span className={styles.rule} />
        <span className={styles.caption} aria-hidden="true">
          ZODE Portal
        </span>
      </div>
      <div className={styles.tray}>
        <span className={styles.caption} aria-hidden="true">
          Settings
        </span>
        <span className={styles.rule} />
        <div className={styles.bar}>
          <div className={styles.group}>
            <RailItem app={settings} current={current.id === "settings"} />
            {/* Initials come from the `<html>` flags in CSS, as in PinnedHeader, so they never pop in at hydration. */}
            <Link href={settings.href} className={styles.avatar}>
              <PortalIcon name="person" className={styles.avatarGlyph} />
              <span className={styles.tooltip}>Account</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
