import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { SiteShell } from "@/components/layout/SiteShell";
import { isTeam, isZodeAdmin } from "@/features/account/admin";
import { getAccount } from "@/features/account/session";
import { loadContracts, loadOrders, loadRooms } from "@/features/portal/data";
import { SIDEBAR_COOKIE } from "@/features/portal/nav";
import { PortalFrame } from "@/features/portal/PortalFrame";
import { PortalNav } from "@/features/portal/PortalNav";
import { PortalSidebar } from "@/features/portal/PortalSidebar";
import styles from "@/features/portal/shell.module.css";

/**
 * The signed-in portal: a black rail of apps down the left, the sidebar for
 * the current app beside it, and the site's pinned header (wordmark nudged
 * right of both) over the panel.
 */
export default async function PortalLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [account, cookieStore] = await Promise.all([getAccount(), cookies()]);
  const [admin, team, rooms, orders, contracts] = account
    ? await Promise.all([
        isZodeAdmin(account),
        isTeam(account),
        loadRooms(account.userId),
        loadOrders(account.userId),
        loadContracts(account.userId),
      ])
    : [false, false, null, null, null];
  const access = { admin, team };

  return (
    <PortalFrame initial={cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed" ? "collapsed" : "open"}>
      <SiteShell
        footer={false}
        fade={false}
        edge="flush"
        nav={
          <>
            <PortalNav access={access} />
            <PortalSidebar
              access={access}
              counts={{ rooms: rooms?.length, orders: orders?.length, contracts: contracts?.length }}
              rooms={rooms && rooms.map(({ id, name, fileCount }) => ({ id, name, fileCount }))}
            />
          </>
        }
      >
        <div className={styles.panel}>{children}</div>
      </SiteShell>
    </PortalFrame>
  );
}
