import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import Link from "next/link";
import { LogoutButton } from "@/features/account/LogoutButton";
import ui from "@/features/data-room/ui.module.css";
import { loadMyHome, orLogIn } from "@/features/portal/mine";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { Empty, OrderList, PageHeader, RoomList, Section, ToolList } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";
import { HomeTabs } from "@/features/team-dashboard/HomeTabs";

export const metadata: Metadata = {
  title: "Portal | ZODE",
};

const RECENT = 3;

/** Signed-in home: who you are, your figures at a glance, and the latest rooms and orders. */
export default function HomePage(): ReactElement {
  return (
    <Suspense fallback={<PortalLoading />}>
      <Home />
    </Suspense>
  );
}

/** The whole page, header included, since it greets the account by name. */
async function Home(): Promise<ReactElement> {
  const { account, team, rooms, orders, contracts } = orLogIn(await loadMyHome(), "/portal");
  const firstName = account.displayName.trim().split(/\s+/)[0] || account.displayName;
  const files = rooms?.reduce((sum, room) => sum + room.fileCount, 0);
  const figure = (value: number | undefined) => (value === undefined ? "—" : value.toLocaleString("en-US"));

  return (
    <div className={styles.page}>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        subtitle={
          <>
            {account.email}
            {account.primaryZid ? <> · {account.primaryZid}</> : null}
          </>
        }
        tabs={team ? <HomeTabs current="mine" /> : null}
        actions={<LogoutButton className={ui.button} />}
      />

      <div className={styles.stats}>
        <Link className={styles.stat} href="/portal/data-rooms">
          <span className={styles.statValue}>{figure(rooms?.length)}</span>
          <span className={styles.statLabel}>Data rooms</span>
        </Link>
        <Link className={styles.stat} href="/portal/data-rooms">
          <span className={styles.statValue}>{figure(files)}</span>
          <span className={styles.statLabel}>Files shared</span>
        </Link>
        <Link className={styles.stat} href="/portal/orders">
          <span className={styles.statValue}>{figure(orders?.length)}</span>
          <span className={styles.statLabel}>Orders</span>
        </Link>
        <Link className={styles.stat} href="/portal/contracts">
          <span className={styles.statValue}>{figure(contracts?.length)}</span>
          <span className={styles.statLabel}>Contracts</span>
        </Link>
      </div>

      <Section title="Recent data rooms" href="/portal/data-rooms">
        {rooms === null ? (
          <Empty>Your data rooms couldn&apos;t be loaded right now. Please try again shortly.</Empty>
        ) : rooms.length ? (
          <RoomList rooms={rooms.slice(0, RECENT)} />
        ) : (
          <Empty>No data rooms yet. Rooms shared with you appear here.</Empty>
        )}
      </Section>

      <Section title="Recent orders" href="/portal/orders">
        {orders === null ? (
          <Empty>Your orders couldn&apos;t be loaded right now. Please try again shortly.</Empty>
        ) : orders.length ? (
          <OrderList orders={orders.slice(0, RECENT)} />
        ) : (
          <Empty>
            No orders yet. <Link href="/buy-compute">Configure a ZODE</Link>
          </Empty>
        )}
      </Section>

      <ToolList />
    </div>
  );
}
