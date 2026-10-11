import type { Metadata } from "next";
import type { ReactElement } from "react";
import Link from "next/link";
import { requireAccount } from "@/features/account/session";
import { listOrdersByEmail, type OrderSummary } from "@/features/configurator/orders";
import { LogoutButton } from "@/features/account/LogoutButton";
import { Icon } from "@/features/data-room/icons";
import { NewRoomForm } from "@/features/data-room/NewRoomForm";
import roomStyles from "@/features/data-room/portal.module.css";
import { listRoomsForUser } from "@/features/data-room/rooms";
import type { RoomSummary } from "@/features/data-room/types";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Portal | ZODE",
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2)).toUpperCase();
}

function OrderRow({ order }: { order: OrderSummary }): ReactElement {
  return (
    <li className={styles.order}>
      <div className={styles.orderMain}>
        <span className={styles.reference}>#{order.reference}</span>
        <span className={styles.badge}>{order.mode === "rent" ? "Rent" : "Buy"}</span>
        <span className={styles.status}>{order.status}</span>
      </div>
      <p className={styles.orderDetail}>
        {order.gpus.toLocaleString("en-US")} GPUs · {order.platform} · {order.location}
      </p>
      <dl className={styles.figures}>
        <div>
          <dt>Placed</dt>
          <dd>{date.format(order.createdAt)}</dd>
        </div>
        <div>
          <dt>{order.mode === "rent" ? "Est. monthly" : "Monthly"}</dt>
          <dd>{usd.format(order.monthlyUsd)}</dd>
        </div>
        {order.totalUsd != null ? (
          <div>
            <dt>Total</dt>
            <dd>{usd.format(order.totalUsd)}</dd>
          </div>
        ) : null}
      </dl>
    </li>
  );
}

function RoomCard({ room }: { room: RoomSummary }): ReactElement {
  return (
    <li>
      <Link className={roomStyles.room} href={`/portal/data-rooms/${room.id}`}>
        <span className={roomStyles.roomTop}>
          <Icon name="folder" className={roomStyles.roomIcon} />
          <span className={roomStyles.roomName}>{room.name}</span>
          <span className={roomStyles.role}>{room.role === "admin" ? "Admin" : "Viewer"}</span>
        </span>
        <p className={roomStyles.roomMeta}>
          {room.fileCount.toLocaleString("en-US")} file{room.fileCount === 1 ? "" : "s"} · Created{" "}
          {date.format(new Date(room.createdAt))}
        </p>
      </Link>
    </li>
  );
}

/** Signed-in home for ZOS accounts: who you are, your data rooms, and the compute orders placed with your email. */
export default async function PortalPage(): Promise<ReactElement> {
  const account = await requireAccount("/portal");
  const [orders, rooms] = await Promise.all([
    listOrdersByEmail(account.email).catch((error: unknown) => {
      console.error("Failed to load portal orders", error);
      return null;
    }),
    listRoomsForUser(account.userId).catch((error: unknown) => {
      console.error("Failed to load data rooms", error);
      return null;
    }),
  ]);

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <section className={styles.account}>
          {/* Initials only: ZOS avatars live on Matrix homeservers, which the CSP and COEP headers block. */}
          <span className={styles.avatar} aria-hidden="true">
            {initials(account.displayName)}
          </span>
          <div className={styles.identity}>
            <h1 className={styles.name}>{account.displayName}</h1>
            <p className={styles.meta}>
              {account.email}
              {account.primaryZid ? <> · {account.primaryZid}</> : null}
            </p>
          </div>
          <LogoutButton className={styles.logout} />
        </section>

        <section aria-labelledby="rooms-heading">
          <div className={roomStyles.header}>
            <h2 id="rooms-heading" className={styles.heading}>
              Data rooms
            </h2>
            <NewRoomForm />
          </div>
          {rooms === null ? (
            <div className={styles.empty}>
              <p>Your data rooms couldn&apos;t be loaded right now. Please try again shortly.</p>
            </div>
          ) : rooms.length ? (
            <ul className={roomStyles.rooms}>
              {rooms.map((room) => (
                <RoomCard key={room.id} room={room} />
              ))}
            </ul>
          ) : (
            <div className={styles.empty}>
              <p>Share documents privately, with views and downloads tracked. Rooms shared with you appear here too.</p>
            </div>
          )}
        </section>

        <section className={styles.orders} aria-labelledby="orders-heading">
          <div className={styles.ordersHeader}>
            <h2 id="orders-heading" className={styles.heading}>
              Compute orders
            </h2>
            <Link className={styles.newOrder} href="/buy-compute">
              New order
            </Link>
          </div>
          {orders === null ? (
            <div className={styles.empty}>
              <p>Your orders couldn&apos;t be loaded right now. Please try again shortly.</p>
            </div>
          ) : orders.length ? (
            <ul className={styles.orderList}>
              {orders.map((order) => (
                <OrderRow key={order.reference} order={order} />
              ))}
            </ul>
          ) : (
            <div className={styles.empty}>
              <p>No orders yet for {account.email}.</p>
              <Link href="/buy-compute">Configure a ZODE</Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
