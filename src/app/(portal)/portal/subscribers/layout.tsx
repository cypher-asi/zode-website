import { Suspense, type ReactElement } from "react";
import { isZodeAdmin } from "@/features/account/admin";
import { getAccount } from "@/features/account/session";
import { ExportLink } from "@/features/mailing-list/ExportLink";
import { MAILING_LISTS } from "@/features/mailing-list/types";
import { PortalLoadingHeader } from "@/features/portal/PortalLoading";
import { TabbedPageHeader, type HeaderTab } from "@/features/portal/TabbedPageHeader";
import styles from "@/features/portal/portal.module.css";

const TABS: readonly HeaderTab[] = [
  {
    href: "/portal/subscribers",
    label: "All",
    title: "Subscribers",
    subtitle: "Both mailing lists, a row per list. Only subscribed addresses have confirmed by email.",
    actions: <ExportLink list={null} />,
  },
  ...MAILING_LISTS.map((list) => ({
    href: `/portal/subscribers/${list.id}`,
    label: list.label,
    title: `${list.label} subscribers`,
    subtitle: `The ${list.label} mailing list. Only subscribed addresses have confirmed by email.`,
    actions: <ExportLink list={list.id} />,
  })),
];

/** The Subscribers app's header, its tabs for both lists and each one, over whichever is open. */
export default function SubscribersLayout({ children }: LayoutProps<"/portal/subscribers">): ReactElement {
  return (
    <div className={styles.page}>
      <Suspense fallback={<PortalLoadingHeader />}>
        <SubscribersHeader />
      </Suspense>
      {children}
    </div>
  );
}

/** ZODE admins only; anyone else's page answers with a 404. */
async function SubscribersHeader(): Promise<ReactElement | null> {
  const account = await getAccount();
  if (!account || !(await isZodeAdmin(account))) return null;
  return <TabbedPageHeader tabs={TABS} label="Mailing lists" />;
}
