import type { ReactElement } from "react";
import Link from "next/link";
import styles from "@/features/data-room/room.module.css";

const TABS = [
  { id: "mine", href: "/portal/contracts", label: "Mine" },
  { id: "all", href: "/portal/contracts/all", label: "All agreements" },
] as const;

/** Shown to ZODE admins only, who can switch between their own agreements and everyone's. */
export function ContractTabs({ current }: { current: (typeof TABS)[number]["id"] }): ReactElement {
  return (
    <nav className={styles.tabs} aria-label="Contracts">
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
