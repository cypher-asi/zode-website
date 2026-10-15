import { Suspense, type ReactElement } from "react";
import Link from "next/link";
import ui from "@/features/data-room/ui.module.css";
import { ORDER_MODES } from "@/features/portal/nav";
import { PortalLoadingHeader } from "@/features/portal/PortalLoading";
import { TabbedPageHeader, type HeaderTab } from "@/features/portal/TabbedPageHeader";
import styles from "@/features/portal/portal.module.css";

const SUBTITLES = {
  all: "Compute you've bought or rented while logged in.",
  buy: "ZODEs you've bought while logged in.",
  rent: "Compute you've rented while logged in.",
} as const;

const TABS: readonly HeaderTab[] = [
  { href: "/portal/orders", label: "All", title: "Orders", subtitle: SUBTITLES.all },
  ...ORDER_MODES.map((mode) => ({
    href: `/portal/orders/${mode.id}`,
    label: mode.label,
    title: mode.label,
    subtitle: SUBTITLES[mode.id],
  })),
];

/**
 * The Orders app's header, its tabs for all orders and each kind, over
 * whichever is open. Suspended for the path, which a kind's page only knows
 * per request.
 */
export default function OrdersLayout({ children }: LayoutProps<"/portal/orders">): ReactElement {
  return (
    <div className={styles.page}>
      <Suspense fallback={<PortalLoadingHeader />}>
        <TabbedPageHeader
          tabs={TABS}
          label="Order types"
          actions={
            <Link className={ui.primary} href="/buy-compute">
              New order
            </Link>
          }
        />
      </Suspense>
      {children}
    </div>
  );
}
