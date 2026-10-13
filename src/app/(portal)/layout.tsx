import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { SiteShell } from "@/components/layout/SiteShell";
import { isTeam, isZodeAdmin } from "@/features/account/admin";
import { getAccount } from "@/features/account/session";
import { loadContracts, loadOrders, loadRooms } from "@/features/portal/data";
import { PortalFrame } from "@/features/portal/PortalFrame";
import { PortalNav } from "@/features/portal/PortalNav";
import { PortalSidebar } from "@/features/portal/PortalSidebar";
import styles from "@/features/portal/shell.module.css";
import { PORTAL_THEME_COOKIE, parsePortalTheme } from "@/features/portal/theme";

/**
 * The signed-in portal: a black rail of apps down the left, the sidebar for
 * the current app beside it, and the panel, all under the site's pinned header.
 */
export default async function PortalLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const account = await getAccount();
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
  const theme = parsePortalTheme((await cookies()).get(PORTAL_THEME_COOKIE)?.value);

  return (
    <PortalFrame initialTheme={theme}>
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
