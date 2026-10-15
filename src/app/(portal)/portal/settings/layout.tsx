import { Suspense, type ReactElement } from "react";
import { LogoutButton } from "@/features/account/LogoutButton";
import ui from "@/features/data-room/ui.module.css";
import { loadMySettings } from "@/features/portal/mine";
import { TabbedPageHeader, type HeaderTab } from "@/features/portal/TabbedPageHeader";
import styles from "@/features/portal/portal.module.css";

const TABS: readonly HeaderTab[] = [
  { href: "/portal/settings", label: "Account", title: "Settings", subtitle: "Your profile and account." },
  {
    href: "/portal/settings/team",
    label: "Team",
    title: "Settings",
    subtitle: "The ZODE team, who can open data rooms. Super admins choose who's on it.",
  },
];

/**
 * The Settings header over Account and, for the ZODE team, Team. The title
 * stands at once; the team's tabs follow the session.
 */
export default function SettingsLayout({ children }: LayoutProps<"/portal/settings">): ReactElement {
  const logout = <LogoutButton className={ui.button} />;
  return (
    <div className={styles.page}>
      <Suspense fallback={<TabbedPageHeader tabs={TABS} label="Settings" showTabs={false} actions={logout} />}>
        <SettingsHeader actions={logout} />
      </Suspense>
      {children}
    </div>
  );
}

async function SettingsHeader({ actions }: { actions: ReactElement }): Promise<ReactElement> {
  const team = (await loadMySettings())?.team ?? false;
  return <TabbedPageHeader tabs={TABS} label="Settings" showTabs={team} actions={actions} />;
}
