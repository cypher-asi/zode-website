import type { ReactElement } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loadMyHome, orLogIn } from "./mine";
import { Empty, OrderList, RoomList, Section, ToolList } from "./sections";
import styles from "./portal.module.css";

const RECENT = 3;

/**
 * Home's Mine tab, under the greeting its layout holds. On `/portal` the ZODE
 * team are sent on to the Team tab; `/portal/mine` keeps them here.
 */
export async function MyHome({ path }: { path: "/portal" | "/portal/mine" }): Promise<ReactElement> {
  const { team, rooms, orders, contracts } = orLogIn(await loadMyHome(), path);
  if (team && path === "/portal") redirect("/portal/team");
  const files = rooms?.reduce((sum, room) => sum + room.fileCount, 0);
  const figure = (value: number | undefined) => (value === undefined ? "—" : value.toLocaleString("en-US"));

  return (
    <>
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
    </>
  );
}
