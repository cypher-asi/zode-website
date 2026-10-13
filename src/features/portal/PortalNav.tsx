"use client";

import type { ReactElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PortalIcon, type PortalIconName } from "./icons";
import { activeGroup, activeHref, navGroups, railLinks, type NavAccess } from "./nav";
import { SidebarToggle } from "./PortalFrame";
import styles from "./shell.module.css";

function RailItem({
  href,
  label,
  icon,
  current,
}: {
  href: string;
  label: string;
  icon: PortalIconName;
  current?: "page" | "true";
}): ReactElement {
  return (
    <Link href={href} className={styles.item} aria-current={current}>
      <PortalIcon name={icon} className={styles.icon} />
      <span className={styles.tooltip}>{label}</span>
    </Link>
  );
}

/**
 * The portal's rail: a black bar in a frosted tray, with Settings in a tray of
 * its own at the foot. Beside the open sidebar it switches between groups
 * (Workspace, Admin), whose links the sidebar lists; with the sidebar hidden,
 * and on narrow screens, it carries every section itself. A bar along the
 * bottom on phones.
 */
export function PortalNav({ access }: { access: NavAccess }): ReactElement {
  const pathname = usePathname() ?? "/portal";
  const groups = navGroups(access);
  const group = activeGroup(pathname, groups);
  const links = railLinks(groups);
  const flatHref = activeHref(pathname, links);
  const settings = groups[groups.length - 1];
  const inSettings = group.id === "settings";

  return (
    <nav className={styles.rail} aria-label="Portal">
      <div className={styles.tray}>
        <div className={styles.bar}>
          <div className={`${styles.group} ${styles.groups}`}>
            {groups
              .filter(({ id }) => id !== "settings")
              .map(({ id, label, icon, links: [first] }) => (
                <RailItem key={id} href={first.href} label={label} icon={icon} current={id === group.id ? "true" : undefined} />
              ))}
          </div>
          <div className={`${styles.group} ${styles.flat}`}>
            {links.map((link) => (
              <RailItem key={link.href} {...link} current={link.href === flatHref ? "page" : undefined} />
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
            <RailItem href={settings.links[0].href} label="Settings" icon="settings" current={inSettings ? "page" : undefined} />
            {/* Initials come from the `<html>` flags in CSS, as in PinnedHeader, so they never pop in at hydration. */}
            <Link href={settings.links[0].href} className={`${styles.avatar} ${styles.flat}`}>
              <PortalIcon name="person" className={styles.avatarGlyph} />
              <span className={styles.tooltip}>Account</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
