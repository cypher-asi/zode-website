import type { Metadata } from "next";
import type { ReactElement } from "react";
import Link from "next/link";
import { requireAccount } from "@/features/account/session";
import ui from "@/features/data-room/ui.module.css";
import { loadOrders } from "@/features/portal/data";
import { Empty, OrderList, PageHeader } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";

export const metadata: Metadata = {
  title: "Orders | ZODE",
  robots: { index: false, follow: false },
};

/** Compute bought or rented while signed in, newest first. */
export default async function OrdersPage(): Promise<ReactElement> {
  const account = await requireAccount("/portal/orders");
  const orders = await loadOrders(account.userId);

  return (
    <div className={styles.page}>
      <PageHeader title="Orders" subtitle="Compute you've bought or rented while logged in.">
        <Link className={ui.primary} href="/buy-compute">
          New order
        </Link>
      </PageHeader>
      {orders === null ? (
        <Empty>Your orders couldn&apos;t be loaded right now. Please try again shortly.</Empty>
      ) : orders.length ? (
        <OrderList orders={orders} />
      ) : (
        <Empty>
          No orders yet. <Link href="/buy-compute">Configure a ZODE</Link>
        </Empty>
      )}
    </div>
  );
}
