"use client";

import type { CSSProperties, ReactElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PortalIcon } from "./icons";
import { activeApp, portalApps, type NavAccess, type PortalApp } from "./nav";
import { usePortalTheme } from "./PortalFrame";
import styles from "./shell.module.css";

/**
 * `arriving` is the item's place among the apps the fallback rail doesn't
 * have, which ease in one after another once the session's access streams in.
 */
function RailItem({ app, current, arriving }: { app: PortalApp; current: boolean; arriving?: number }): ReactElement {
  return (
    <Link
      href={app.href}
      className={arriving === undefined ? styles.item : `${styles.item} ${styles.arriving}`}
      style={arriving === undefined ? undefined : ({ "--i": arriving } as CSSProperties)}
      aria-current={current ? "page" : undefined}
    >
      <PortalIcon name={app.icon} className={styles.icon} />
      <span className={styles.tooltip}>{app.label}</span>
    </Link>
  );
}

/** Flips the portal between light and dark, showing the theme it switches to. */
function ThemeToggle(): ReactElement {
  const { theme, toggle } = usePortalTheme();
  const dark = theme === "dark";
  return (
    <button type="button" className={styles.item} aria-pressed={dark} onClick={toggle}>
      <PortalIcon name={dark ? "sun" : "moon"} className={styles.icon} />
      <span className={styles.tooltip}>{dark ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}

/**
 * The portal's apps down a black bar in a frosted tray, with the theme toggle,
 * Settings and the account in a tray of their own at the foot; the sidebar beside it lists
 * whichever app you're in. A bar along the bottom on phones.
 */
export function PortalNav({ access }: { access: NavAccess }): ReactElement {
  const pathname = usePathname() ?? "/portal";
  const apps = portalApps(access);
  const current = activeApp(pathname, apps);
  const settings = apps[apps.length - 1];
  const rail = apps.slice(0, -1);
  const everyone = rail.filter((app) => !app.team);
  const team = rail.filter((app) => app.team);

  return (
    <nav className={styles.rail} aria-label="Portal">
      <div className={styles.tray}>
        <div className={styles.bar}>
          <div className={styles.group}>
            {everyone.map((app) => (
              <RailItem key={app.id} app={app} current={app.id === current.id} />
            ))}
            {team.length ? <hr className={`${styles.divider} ${styles.arriving}`} /> : null}
            {team.map((app, index) => (
              <RailItem key={app.id} app={app} current={app.id === current.id} arriving={index} />
            ))}
          </div>
        </div>
      </div>
      <div className={styles.tray}>
        <div className={styles.bar}>
          <div className={styles.group}>
            <ThemeToggle />
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
