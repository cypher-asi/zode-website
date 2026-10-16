"use client";

import { createContext, use, useState, type ReactElement, type ReactNode } from "react";
import { PortalTabs } from "@/features/portal/PortalTabs";
import styles from "./deployments.module.css";

export type DeploymentTab = "summary" | "bom";

const TabContext = createContext<{
  tab: DeploymentTab;
  base: string;
  select: (tab: DeploymentTab) => void;
} | null>(null);

const hrefOf = (base: string, tab: DeploymentTab) => (tab === "bom" ? `${base}?tab=bom` : base);

/**
 * A deployment's page, its Summary and BOM tabs switching in the browser: both
 * are already on the page, and only `?tab=` changes, so the header, sidebar
 * and everything around them stay exactly where they are.
 */
export function DeploymentTabs({
  base,
  initial,
  children,
}: {
  /** The deployment's page, e.g. /portal/deployments/<id>. */
  base: string;
  initial: DeploymentTab;
  children: ReactNode;
}): ReactElement {
  const [tab, setTab] = useState(initial);
  const select = (next: DeploymentTab) => {
    setTab(next);
    window.history.replaceState(null, "", hrefOf(base, next));
  };
  return <TabContext value={{ tab, base, select }}>{children}</TabContext>;
}

/** The Summary and BOM switch, for the page header's tabs. */
export function DeploymentTabSwitch(): ReactElement {
  const context = use(TabContext);
  if (!context) throw new Error("DeploymentTabSwitch needs DeploymentTabs around it");
  const { tab, base, select } = context;
  return (
    <PortalTabs
      tabs={[
        { href: hrefOf(base, "summary"), label: "Summary" },
        { href: hrefOf(base, "bom"), label: "BOM" },
      ]}
      label="Deployment"
      active={hrefOf(base, tab)}
      onSelect={(href) => select(href === hrefOf(base, "bom") ? "bom" : "summary")}
    />
  );
}

/** One tab's content, laid out as part of the page and hidden while another tab is open. */
export function DeploymentTabPanel({ tab, children }: { tab: DeploymentTab; children: ReactNode }): ReactElement {
  const context = use(TabContext);
  return (
    <div className={styles.tabPanel} hidden={context ? context.tab !== tab : tab !== "summary"}>
      {children}
    </div>
  );
}
