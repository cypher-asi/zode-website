import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import tabs from "@/features/data-room/room.module.css";
import ui from "@/features/data-room/ui.module.css";
import { loadMyOrders, orLogIn } from "@/features/portal/mine";
import { ORDER_MODES } from "@/features/portal/nav";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { Empty, OrderList, PageHeader } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";

export const metadata: Metadata = {
  title: "Orders | ZODE",
  robots: { index: false, follow: false },
};

const TABS = [
  { id: "all", label: "All", href: "/portal/orders" },
  ...ORDER_MODES.map((mode) => ({ id: mode.id, label: mode.label, href: `/portal/orders/${mode.id}` })),
];

const SUBTITLES = {
  all: "Compute you've bought or rented while logged in.",
  buy: "ZODEs you've bought while logged in.",
  rent: "Compute you've rented while logged in.",
} as const;

/** Compute bought or rented while signed in, or one of the two, newest first. */
export default function OrdersPage({ params }: PageProps<"/portal/orders/[[...mode]]">): ReactElement {
  return (
    <Suspense fallback={<PortalLoading />}>
      <Orders params={params} />
    </Suspense>
  );
}

/**
 * The whole page, header included, since its title and tabs follow the URL.
 * The orders are loaded for both kinds and filtered here, so every tab shares them.
 */
async function Orders({ params }: { params: PageProps<"/portal/orders/[[...mode]]">["params"] }): Promise<ReactElement> {
  const [{ mode: segments }, mine] = await Promise.all([params, loadMyOrders()]);
  const mode = segments ? ORDER_MODES.find(({ id }) => id === segments[0]) : undefined;
  if (segments && (segments.length > 1 || !mode)) notFound();

  const { orders } = orLogIn(mine, mode ? `/portal/orders/${mode.id}` : "/portal/orders");
  const shown = orders && mode ? orders.filter((order) => order.mode === mode.id) : orders;

  return (
    <div className={styles.page}>
      <PageHeader title={mode ? mode.label : "Orders"} subtitle={SUBTITLES[mode?.id ?? "all"]}>
        <div className={tabs.headerActions}>
          <nav className={tabs.tabs} aria-label="Order types">
            {TABS.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                className={tabs.tab}
                aria-current={(mode?.id ?? "all") === tab.id ? "page" : undefined}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
          <Link className={ui.primary} href="/buy-compute">
            New order
          </Link>
        </div>
      </PageHeader>
      {shown === null ? (
        <Empty>Your orders couldn&apos;t be loaded right now. Please try again shortly.</Empty>
      ) : shown.length ? (
        <OrderList orders={shown} />
      ) : (
        <Empty>
          {mode ? `No ${mode.label.toLowerCase()} yet.` : "No orders yet."} <Link href="/buy-compute">Configure a ZODE</Link>
        </Empty>
      )}
    </div>
  );
}
