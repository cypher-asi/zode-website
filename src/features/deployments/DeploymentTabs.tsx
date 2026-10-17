"use client";

import { createContext, use, useState, type ReactElement, type ReactNode } from "react";
import { PortalTabs } from "@/features/portal/PortalTabs";
import styles from "./deployments.module.css";
import { TABS, tabHref, type DeploymentTab } from "./tabs";

const TabContext = createContext<{
  tab: DeploymentTab;
  base: string;
  select: (tab: DeploymentTab) => void;
} | null>(null);

/**
 * A deployment's page, its Summary, BOM and Quotes tabs switching in the
 * browser: all are already on the page, and only `?tab=` changes, so the
 * header, sidebar and everything around them stay exactly where they are.
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
    window.history.replaceState(null, "", tabHref(base, next));
  };
  return <TabContext value={{ tab, base, select }}>{children}</TabContext>;
}

/** The tab switch, for the page header's tabs. */
export function DeploymentTabSwitch(): ReactElement {
  const context = use(TabContext);
  if (!context) throw new Error("DeploymentTabSwitch needs DeploymentTabs around it");
  const { tab, base, select } = context;
  return (
    <PortalTabs
      tabs={TABS.map((t) => ({ href: tabHref(base, t.id), label: t.label }))}
      label="Deployment"
      active={tabHref(base, tab)}
      onSelect={(href) => select(TABS.find((t) => tabHref(base, t.id) === href)?.id ?? "summary")}
    />
  );
}

/** The open tab, or null outside `DeploymentTabs`. */
export function useDeploymentTab(): DeploymentTab | null {
  return use(TabContext)?.tab ?? null;
}

/** A link to another tab that switches to it in place, like the header's tabs. */
export function TabLink({
  tab,
  className,
  label,
  children,
}: {
  tab: DeploymentTab;
  className?: string;
  /** Names the link when its children are only an icon. */
  label?: string;
  children: ReactNode;
}): ReactElement {
  const context = use(TabContext);
  return (
    <a
      href={context ? tabHref(context.base, tab) : undefined}
      className={className}
      aria-label={label}
      title={label}
      onClick={(event) => {
        if (!context || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        context.select(tab);
        window.scrollTo({ top: 0 });
      }}
    >
      {children}
    </a>
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
