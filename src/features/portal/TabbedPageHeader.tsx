"use client";

import { useState, type ReactElement, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import bar from "@/features/data-room/room.module.css";
import { PortalTabs, useTabNavigation, type PortalTab } from "./PortalTabs";
import styles from "./portal.module.css";

export interface HeaderTab extends PortalTab {
  title: string;
  subtitle?: ReactNode;
  /** Ahead of the header's own actions while this tab is open. */
  actions?: ReactNode;
  /** Other paths that show this tab's page, e.g. an app's root. */
  aliases?: readonly string[];
}

/**
 * PageHeader for an app whose sections are tabs, rendered by the app's layout
 * so it stays put while the tabs' pages swap beneath it. The title, subtitle
 * and actions follow the open tab, switching with the chip on click. With the
 * path matching no tab, the first tab's title stands.
 */
export function TabbedPageHeader({
  tabs,
  label,
  showTabs = true,
  actions,
}: {
  tabs: readonly HeaderTab[];
  label: string;
  /** False for accounts that only have the first tab, e.g. off the ZODE team. */
  showTabs?: boolean;
  actions?: ReactNode;
}): ReactElement {
  const pathname = usePathname();
  const [active, select] = useTabNavigation(
    tabs.find((tab) => tab.href === pathname || tab.aliases?.includes(pathname))?.href,
  );
  const tab = tabs.find(({ href }) => href === active) ?? tabs[0];
  // The title only eases in on a switch, not as the page first paints.
  const [switched, setSwitched] = useState(false);
  const swap = switched ? styles.swapIn : undefined;

  return (
    <header className={styles.header}>
      <div className={styles.heading}>
        <h1 key={tab.title} className={swap ? `${styles.title} ${swap}` : styles.title}>
          {tab.title}
        </h1>
        {tab.subtitle ? (
          <p key={tab.href} className={swap ? `${styles.subtitle} ${swap}` : styles.subtitle}>
            {tab.subtitle}
          </p>
        ) : null}
      </div>
      {(showTabs && tabs.length > 1) || tab.actions || actions ? (
        <div className={bar.headerActions}>
          {showTabs && tabs.length > 1 ? (
            <PortalTabs
              tabs={tabs}
              label={label}
              active={active}
              onSelect={(href) => {
                setSwitched(true);
                select(href);
              }}
            />
          ) : null}
          {tab.actions}
          {actions}
        </div>
      ) : null}
    </header>
  );
}
