import { Suspense, type ReactElement } from "react";
import { isTeam } from "@/features/account/admin";
import { getAccount } from "@/features/account/session";
import { LEAD_TYPES, type LeadType } from "@/features/leads/types";
import { PortalLoadingHeader } from "@/features/portal/PortalLoading";
import { TabbedPageHeader, type HeaderTab } from "@/features/portal/TabbedPageHeader";
import styles from "@/features/portal/portal.module.css";

const SUBTITLES: Record<LeadType | "all", string> = {
  all: "Orders, Talk to an Engineer requests and Invest inquiries from the site.",
  buy: "Configurator purchases and engineer requests about buying a ZODE.",
  rent: "Configurator rentals and engineer requests about renting compute.",
  invest: "Inquiries from the Invest form about company equity and project finance.",
};

const TABS: readonly HeaderTab[] = [
  { href: "/portal/leads", label: "All", title: "Leads", subtitle: SUBTITLES.all },
  ...LEAD_TYPES.map((type) => ({
    href: `/portal/leads/${type.id}`,
    label: type.label,
    title: `${type.label} leads`,
    subtitle: SUBTITLES[type.id],
  })),
];

/** The Leads app's header, its tabs for all leads and each type, over whichever is open. */
export default function LeadsLayout({ children }: LayoutProps<"/portal/leads">): ReactElement {
  return (
    <div className={styles.page}>
      <Suspense fallback={<PortalLoadingHeader />}>
        <LeadsHeader />
      </Suspense>
      {children}
    </div>
  );
}

/** The ZODE team only; anyone else's page answers with a 404. */
async function LeadsHeader(): Promise<ReactElement | null> {
  const account = await getAccount();
  if (!account || !(await isTeam(account))) return null;
  return <TabbedPageHeader tabs={TABS} label="Lead types" />;
}
