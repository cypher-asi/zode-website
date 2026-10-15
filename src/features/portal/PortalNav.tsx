"use client";

import { useState, type CSSProperties, type ReactElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PortalIcon } from "./icons";
import { activeApp, portalApps, TAB_BAR_APPS, type NavAccess, type PortalApp } from "./nav";
import { usePortalRail, usePortalTheme } from "./PortalFrame";
import { PortalMoreSheet } from "./PortalMoreSheet";
import styles from "./shell.module.css";

/**
 * `arriving` is the item's place among the apps the fallback rail doesn't
 * have, which ease in one after another once the session's access streams in.
 * `overflow` items live in the More sheet on phones.
 */
function RailItem({
  app,
  current,
  arriving,
  overflow,
}: {
  app: PortalApp;
  current: boolean;
  arriving?: number;
  overflow?: boolean;
}): ReactElement {
  const className = [styles.item, arriving === undefined ? null : styles.arriving, overflow ? styles.overflow : null]
    .filter(Boolean)
    .join(" ");
  return (
    <Link
      href={app.href}
      className={className}
      style={arriving === undefined ? undefined : ({ "--i": arriving } as CSSProperties)}
      aria-current={current ? "page" : undefined}
    >
      <PortalIcon name={app.icon} className={styles.icon} />
      <span className={styles.label} aria-hidden="true">
        {app.tabLabel ?? app.label}
      </span>
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

const RAIL_ID = "portal-rail";

/** Widens the rail to show each app's name beside its icon, or narrows it back to icons. */
function RailToggle(): ReactElement {
  const { expanded, toggle } = usePortalRail();
  const name = expanded ? "Collapse menu" : "Expand menu";
  return (
    <button
      type="button"
      className={styles.item}
      aria-expanded={expanded}
      aria-controls={RAIL_ID}
      onClick={toggle}
    >
      <PortalIcon name="panel" className={styles.icon} />
      <span className={styles.tooltip}>{name}</span>
    </button>
  );
}

/**
 * The portal's apps down a black bar in a frosted tray, with the rail's
 * expand toggle, the theme toggle and Settings in a tray of their own at the
 * foot (the account sits in the pinned header, right of Buy Compute); the
 * sidebar beside it lists whichever app you're in. Expanded, the rail shows
 * each app's name beside its icon. On phones, a tab bar along the bottom: the first
 * apps, then More for the rest, which takes the icon and name of the app
 * you're in when it's one of them.
 */
export function PortalNav({ access }: { access: NavAccess }): ReactElement {
  const pathname = usePathname() ?? "/portal";
  const [moreOpen, setMoreOpen] = useState(false);
  const apps = portalApps(access);
  const current = activeApp(pathname, apps);
  const settings = apps[apps.length - 1];
  const rail = apps.slice(0, -1);
  const everyone = rail.filter((app) => !app.team);
  const team = rail.filter((app) => app.team);
  const tabbed = new Set(rail.slice(0, TAB_BAR_APPS).map(({ id }) => id));
  const extra = apps.filter(({ id }) => !tabbed.has(id));
  const inMore = extra.find(({ id }) => id === current.id);

  return (
    <nav id={RAIL_ID} className={styles.rail} aria-label="Portal">
      <div className={styles.tray}>
        <div className={styles.bar}>
          <div className={styles.group}>
            {everyone.map((app) => (
              <RailItem key={app.id} app={app} current={app.id === current.id} overflow={!tabbed.has(app.id)} />
            ))}
            {team.length ? <hr className={`${styles.divider} ${styles.arriving}`} /> : null}
            {team.map((app, index) => (
              <RailItem
                key={app.id}
                app={app}
                current={app.id === current.id}
                arriving={index}
                overflow={!tabbed.has(app.id)}
              />
            ))}
            <button
              type="button"
              className={`${styles.item} ${styles.more}`}
              data-active={inMore ? "" : undefined}
              aria-label={inMore ? `More (${inMore.label})` : undefined}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen(true)}
            >
              <PortalIcon name={inMore?.icon ?? "more"} className={styles.icon} />
              <span className={styles.label}>{inMore ? (inMore.tabLabel ?? inMore.label) : "More"}</span>
            </button>
          </div>
        </div>
      </div>
      <div className={styles.tray}>
        <div className={styles.bar}>
          <div className={styles.group}>
            <RailToggle />
            <ThemeToggle />
            <RailItem app={settings} current={current.id === "settings"} />
          </div>
        </div>
      </div>
      {moreOpen ? <PortalMoreSheet apps={extra} current={current.id} onClose={() => setMoreOpen(false)} /> : null}
    </nav>
  );
}
