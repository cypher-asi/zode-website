"use client";

import type { ReactElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PortalIcon, type PortalIconName } from "@/features/portal/icons";
import styles from "./room.module.css";

interface RoomTab {
  href: string;
  label: string;
  /** Shown in place of the label, which becomes the tab's accessible name and tooltip. */
  icon?: PortalIconName;
}

export function RoomTabs({ roomId, isAdmin }: { roomId: string; isAdmin: boolean }): ReactElement {
  const pathname = usePathname();
  const base = `/portal/data-rooms/${roomId}`;
  const tabs: RoomTab[] = [
    { href: base, label: "Files" },
    ...(isAdmin
      ? [
          { href: `${base}/members`, label: "Members" },
          { href: `${base}/activity`, label: "Activity" },
          { href: `${base}/settings`, label: "Settings", icon: "settings" as const },
        ]
      : []),
  ];

  return (
    <nav className={styles.tabs} aria-label="Data room sections">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={tab.icon ? `${styles.tab} ${styles.iconTab}` : styles.tab}
          aria-current={pathname === tab.href ? "page" : undefined}
          aria-label={tab.icon ? tab.label : undefined}
          title={tab.icon ? tab.label : undefined}
        >
          {tab.icon ? <PortalIcon name={tab.icon} className={styles.tabIcon} /> : tab.label}
        </Link>
      ))}
    </nav>
  );
}
