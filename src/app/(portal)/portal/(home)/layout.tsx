import { Suspense, type ReactElement } from "react";
import { loadMyHome } from "@/features/portal/mine";
import { PortalLoadingHeader } from "@/features/portal/PortalLoading";
import { TabbedPageHeader } from "@/features/portal/TabbedPageHeader";
import styles from "@/features/portal/portal.module.css";

/** Home's header, greeting the account by name, with Mine and Team tabs for the ZODE team. */
export default function HomeLayout({ children }: LayoutProps<"/portal">): ReactElement {
  return (
    <div className={styles.page}>
      <Suspense fallback={<PortalLoadingHeader />}>
        <HomeHeader />
      </Suspense>
      {children}
    </div>
  );
}

/** Signed out, the page sends the visitor to log in. */
async function HomeHeader(): Promise<ReactElement | null> {
  const mine = await loadMyHome();
  if (!mine) return null;
  const { account, team } = mine;
  const firstName = account.displayName.trim().split(/\s+/)[0] || account.displayName;

  return (
    <TabbedPageHeader
      label="Dashboard"
      showTabs={team}
      tabs={[
        {
          href: "/portal/mine",
          label: "Mine",
          title: `Welcome back, ${firstName}`,
          subtitle: (
            <>
              {account.email}
              {account.primaryZid ? <> · {account.primaryZid}</> : null}
            </>
          ),
        },
        {
          href: "/portal/team",
          aliases: team ? ["/portal"] : undefined,
          label: "Team",
          title: "SimmMaxxer Dashboard",
          subtitle: "ZODE's capacity, pipeline, contracts and audience, tracked daily.",
        },
      ]}
    />
  );
}
