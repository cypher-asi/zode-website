import type { ReactNode } from "react";
import { SiteShell } from "@/components/layout/SiteShell";
import { devDbSwitchAvailable, devDbTarget } from "@/lib/db";
import { DevDbSwitch } from "@/features/portal/DevDbSwitch";
import { PortalNav } from "@/features/portal/PortalNav";
import styles from "@/features/portal/shell.module.css";

/** The signed-in portal: the site's pinned header, with the section icons running down under the wordmark. */
export default function PortalLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <SiteShell footer={false} fade={false} edge="tight" nav={<PortalNav />}>
      <div className={styles.content}>
        <div className={styles.panel}>{children}</div>
      </div>
      {devDbSwitchAvailable() ? <DevDbSwitch current={devDbTarget()} /> : null}
    </SiteShell>
  );
}
