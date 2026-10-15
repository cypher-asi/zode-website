import { Suspense, type ReactElement } from "react";
import { isZodeAdmin } from "@/features/account/admin";
import { getAccount } from "@/features/account/session";
import { PortalLoadingHeader } from "@/features/portal/PortalLoading";
import { TabbedPageHeader, type HeaderTab } from "@/features/portal/TabbedPageHeader";
import { InviteUserButton } from "@/features/users/InviteUserButton";
import { ROLE_LABELS, ROLE_SLUGS, USER_ROLES, type UserRole } from "@/features/users/types";
import styles from "@/features/portal/portal.module.css";

const SUBTITLES: Record<UserRole | "all", string> = {
  all: "Everyone who has signed in, by ZODE user id. New accounts start as Regular.",
  member: "Everyone who isn't on the ZODE team: newsletter sign-ups, room guests and customers.",
  team: "The ZODE team, who can open data rooms, ZRM and Posts.",
  super_admin: "Everything the Team can do, plus every account's records and anyone's role.",
};

/** The Users app's header, its tabs for everyone, each role and pending invites, over whichever is open. */
export default function UsersLayout({ children }: LayoutProps<"/portal/users">): ReactElement {
  return (
    <div className={styles.page}>
      <Suspense fallback={<PortalLoadingHeader />}>
        <UsersHeader />
      </Suspense>
      {children}
    </div>
  );
}

/** Super admins only; anyone else's page answers with a 404. */
async function UsersHeader(): Promise<ReactElement | null> {
  const account = await getAccount();
  if (!account || !(await isZodeAdmin(account))) return null;

  const tabs: HeaderTab[] = [
    {
      href: "/portal/users",
      label: "All",
      title: "Users",
      subtitle: SUBTITLES.all,
      actions: <InviteUserButton defaultRole="member" />,
    },
    ...USER_ROLES.map((role) => ({
      href: `/portal/users/${ROLE_SLUGS[role]}`,
      label: ROLE_LABELS[role],
      title: ROLE_LABELS[role],
      subtitle: SUBTITLES[role],
      actions: <InviteUserButton defaultRole={role === "team" ? "team" : "member"} />,
    })),
    {
      href: "/portal/users/invites",
      label: "Invites",
      title: "Invites",
      subtitle: "Invites not yet accepted, for Regular and Team. Each link expires after 14 days; Resend sends a fresh one.",
      actions: <InviteUserButton defaultRole="member" />,
    },
  ];

  return <TabbedPageHeader tabs={tabs} label="User types" />;
}
