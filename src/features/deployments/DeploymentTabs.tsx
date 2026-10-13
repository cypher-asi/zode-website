import type { ReactElement } from "react";
import Link from "next/link";
import styles from "@/features/data-room/room.module.css";

const TABS = [
  { id: "active", href: "/portal/deployments", label: "Active" },
  { id: "all", href: "/portal/deployments/all", label: "All" },
] as const;

export type DeploymentScope = (typeof TABS)[number]["id"];

export function DeploymentTabs({ current }: { current: DeploymentScope }): ReactElement {
  return (
    <nav className={styles.tabs} aria-label="Deployments">
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
