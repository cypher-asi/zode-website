import type { ReactNode } from "react";
import { SiteShell } from "@/components/layout/SiteShell";
import { isZodeAdmin } from "@/features/account/admin";
import { getAccount } from "@/features/account/session";
import { devDbSwitchAvailable, devDbTarget } from "@/lib/db";
import { DevDbSwitch } from "@/features/portal/DevDbSwitch";
import { PortalNav } from "@/features/portal/PortalNav";
import styles from "@/features/portal/shell.module.css";

/** The signed-in portal: the site's pinned header, with the section icons running down under the wordmark. */
export default async function PortalLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const account = await getAccount();

  return (
    <SiteShell
      footer={false}
      fade={false}
      edge="tight"
      nav={<PortalNav admin={account ? isZodeAdmin(account) : false} />}
    >
      <div className={styles.content}>
        <div className={styles.panel}>{children}</div>
      </div>
      {devDbSwitchAvailable() ? <DevDbSwitch current={devDbTarget()} /> : null}
    </SiteShell>
  );
}
