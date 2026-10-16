import type { ReactElement } from "react";
import Link from "next/link";
import { TeamDashboard } from "@/features/team-dashboard/TeamDashboard";
import { loadMyHome, orLogIn } from "./mine";
import { Empty, OrderList, RoomList, Section, ToolList } from "./sections";
import styles from "./portal.module.css";

const RECENT = 3;

/**
 * Home's Mine tab, under the greeting its layout holds. On `/portal` the ZODE
 * team get the Team tab instead; `/portal/mine` keeps them here. It's shown in
 * place rather than redirected to, since a prerendered component that throws
 * trips React's dev performance track ("cannot have a negative time stamp").
 */
export async function MyHome({ path }: { path: "/portal" | "/portal/mine" }): Promise<ReactElement> {
  const { account, team, rooms, orders, contracts } = orLogIn(await loadMyHome(), path);
  if (team && path === "/portal") return <TeamDashboard account={account} />;
  const files = rooms?.reduce((sum, room) => sum + room.fileCount, 0);
  const figure = (value: number | undefined) => (value === undefined ? "—" : value.toLocaleString("en-US"));

  return (
    <>
      <div className={styles.stats}>
        <Link className={styles.stat} href="/portal/data-rooms">
          <span className={styles.statValue}>{figure(rooms?.length)}</span>
          <span className={styles.statLabel}>Data Rooms</span>
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
    </>
  );
}
