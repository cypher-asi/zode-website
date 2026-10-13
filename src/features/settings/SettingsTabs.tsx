import type { ReactElement } from "react";
import Link from "next/link";
import styles from "@/features/data-room/room.module.css";

const TABS = [
  { id: "account", href: "/portal/settings", label: "Account" },
  { id: "team", href: "/portal/settings/team", label: "Team" },
] as const;

/** Shown to the ZODE team only, who can switch between their own settings and the team. */
export function SettingsTabs({ current }: { current: (typeof TABS)[number]["id"] }): ReactElement {
  return (
    <nav className={styles.tabs} aria-label="Settings">
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
