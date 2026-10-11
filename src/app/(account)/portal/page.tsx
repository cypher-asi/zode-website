import type { Metadata } from "next";
import type { ReactElement } from "react";
import Link from "next/link";
import { requireAccount } from "@/lib/account-session";
import { listOrdersByEmail, type OrderSummary } from "@/lib/orders";
import { LogoutButton } from "./LogoutButton";
import styles from "./portal.module.css";

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

/** Signed-in home for ZOS accounts: who you are, and the compute orders placed with your email. */
export default async function PortalPage(): Promise<ReactElement> {
  const account = await requireAccount("/portal");
  const orders = await listOrdersByEmail(account.email).catch((error: unknown) => {
    console.error("Failed to load portal orders", error);
    return null;
  });

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
