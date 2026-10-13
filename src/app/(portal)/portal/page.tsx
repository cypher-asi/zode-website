import type { Metadata } from "next";
import type { ReactElement } from "react";
import Link from "next/link";
import { isZodeAdmin } from "@/features/account/admin";
import { LogoutButton } from "@/features/account/LogoutButton";
import { requireAccount } from "@/features/account/session";
import ui from "@/features/data-room/ui.module.css";
import { loadContracts, loadOrders, loadRooms } from "@/features/portal/data";
import { Empty, OrderList, PageHeader, RoomList, Section } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";

export const metadata: Metadata = {
  title: "Portal | ZODE",
};

const RECENT = 3;

/** Signed-in home: who you are, your figures at a glance, and the latest rooms and orders. */
export default async function HomePage(): Promise<ReactElement> {
  const account = await requireAccount("/portal");
  const [rooms, orders, contracts, superAdmin] = await Promise.all([
    loadRooms(account.userId),
    loadOrders(account.userId),
    loadContracts(account.userId),
    isZodeAdmin(account),
  ]);
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
      >
        <LogoutButton className={ui.button} />
      </PageHeader>

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
          <RoomList rooms={rooms.slice(0, RECENT)} superAdmin={superAdmin} />
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
    </div>
  );
}
