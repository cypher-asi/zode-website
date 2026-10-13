import type { ReactElement } from "react";
import Link from "next/link";
import styles from "@/features/data-room/room.module.css";

const TABS = [
  { id: "mine", href: "/portal/mine", label: "Mine" },
  { id: "team", href: "/portal/team", label: "Team" },
] as const;

/** Shown to the ZODE team only, who can switch Home between their own things and the team dashboard. */
export function HomeTabs({ current }: { current: (typeof TABS)[number]["id"] }): ReactElement {
  return (
    <nav className={styles.tabs} aria-label="Dashboard">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          className={styles.tab}
          aria-current={tab.id === current ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
