import type { ReactNode } from "react";
import { SiteShell } from "@/components/layout/SiteShell";
import { isZodeAdmin } from "@/features/account/admin";
import { getAccount } from "@/features/account/session";
import { PortalNav } from "@/features/portal/PortalNav";
import styles from "@/features/portal/shell.module.css";

/**
 * The signed-in portal: a black rail of section icons down the left, with the
 * site's pinned header (wordmark nudged right of the rail) over the panel.
 */
export default async function PortalLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const account = await getAccount();

  return (
    <div className={styles.frame}>
      <SiteShell
        footer={false}
        fade={false}
        edge="tight"
        nav={<PortalNav admin={account ? isZodeAdmin(account) : false} />}
      >
        <div className={styles.panel}>{children}</div>
      </SiteShell>
    </div>
  );
}
