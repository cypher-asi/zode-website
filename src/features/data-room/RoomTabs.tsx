"use client";

import type { ReactElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./room.module.css";

export function RoomTabs({ roomId, isAdmin }: { roomId: string; isAdmin: boolean }): ReactElement {
  const pathname = usePathname();
  const base = `/portal/data-rooms/${roomId}`;
  const tabs = [
    { href: base, label: "Summary" },
    { href: `${base}/files`, label: "Files" },
    ...(isAdmin
      ? [
          { href: `${base}/members`, label: "Members" },
          { href: `${base}/activity`, label: "Activity" },
        ]
      : []),
  ];

  return (
    <nav className={styles.tabs} aria-label="Data room sections">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={styles.tab}
          aria-current={pathname === tab.href ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
