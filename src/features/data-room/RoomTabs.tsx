"use client";

import type { ReactElement } from "react";
import { RouteTabs, type PortalTab } from "@/features/portal/PortalTabs";

export function RoomTabs({ roomId, isAdmin }: { roomId: string; isAdmin: boolean }): ReactElement {
  const base = `/portal/data-rooms/${roomId}`;
  const tabs: PortalTab[] = [
    { href: base, label: "Files" },
    ...(isAdmin
      ? [
          { href: `${base}/members`, label: "Members" },
          { href: `${base}/activity`, label: "Activity" },
          { href: `${base}/settings`, label: "Settings", icon: "settings" as const },
        ]
      : []),
  ];

  return <RouteTabs tabs={tabs} label="Data room sections" />;
}
