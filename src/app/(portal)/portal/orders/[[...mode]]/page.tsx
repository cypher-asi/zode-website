import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadMyOrders, orLogIn } from "@/features/portal/mine";
import { ORDER_MODES } from "@/features/portal/nav";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { Empty, OrderList } from "@/features/portal/sections";

export const metadata: Metadata = {
  title: "Orders | ZODE",
  robots: { index: false, follow: false },
};

/** Compute bought or rented while signed in, or one of the two, newest first. The layout holds the header. */
export default function OrdersPage({ params }: PageProps<"/portal/orders/[[...mode]]">): ReactElement {
  return (
    <Suspense fallback={<PortalLoading header={false} nested />}>
      <Orders params={params} />
    </Suspense>
  );
}

/** The orders are loaded for both kinds and filtered here, so every tab shares them. */
async function Orders({ params }: { params: PageProps<"/portal/orders/[[...mode]]">["params"] }): Promise<ReactElement> {
  const [{ mode: segments }, mine] = await Promise.all([params, loadMyOrders()]);
  const mode = segments ? ORDER_MODES.find(({ id }) => id === segments[0]) : undefined;
  if (segments && (segments.length > 1 || !mode)) notFound();

  const { orders } = orLogIn(mine, mode ? `/portal/orders/${mode.id}` : "/portal/orders");
  const shown = orders && mode ? orders.filter((order) => order.mode === mode.id) : orders;

  return shown === null ? (
    <Empty>Your orders couldn&apos;t be loaded right now. Please try again shortly.</Empty>
  ) : shown.length ? (
    <OrderList orders={shown} />
  ) : (
    <Empty>
      {mode ? `No ${mode.label.toLowerCase()} yet.` : "No orders yet."} <Link href="/buy-compute">Configure a ZODE</Link>
    </Empty>
  );
}
