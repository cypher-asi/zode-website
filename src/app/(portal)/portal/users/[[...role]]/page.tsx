import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isZodeAdmin } from "@/features/account/admin";
import { requireAccount } from "@/features/account/session";
import { loadUsers } from "@/features/portal/data";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { Empty, PageHeader, UserList } from "@/features/portal/sections";
import { ROLE_LABELS, ROLE_SLUGS, USER_ROLES, roleForSlug, type UserRole } from "@/features/users/types";
import tabs from "@/features/data-room/room.module.css";
import styles from "@/features/portal/portal.module.css";

export const metadata: Metadata = {
  title: "Users | ZODE",
  robots: { index: false, follow: false },
};

const TABS: readonly { id: UserRole | "all"; label: string; href: string }[] = [
  { id: "all", label: "All", href: "/portal/users" },
  ...USER_ROLES.map((role) => ({ id: role, label: ROLE_LABELS[role], href: `/portal/users/${ROLE_SLUGS[role]}` })),
];

const SUBTITLES: Record<UserRole | "all", string> = {
  all: "Everyone who has signed in, by ZODE user id. New accounts start as Regular.",
  member: "Everyone who isn't on the ZODE team: newsletter sign-ups, room guests and customers.",
  team: "The ZODE team, who can open data rooms, ZRM and Posts.",
  super_admin: "Everything the Team can do, plus every account's records and anyone's role.",
};

const EMPTY: Record<UserRole | "all", string> = {
  all: "No one has signed in yet.",
  member: "No Regular accounts yet.",
  team: "No one is on the Team yet. Invite people from Settings › Team.",
  super_admin: "No super admins yet.",
};

/** Every account that has signed in, or those with one role, by ZODE user id. Super admins only. */
export default function UsersPage({ params }: PageProps<"/portal/users/[[...role]]">): ReactElement {
  return (
    <Suspense fallback={<PortalLoading />}>
      <Users params={params} />
    </Suspense>
  );
}

/** The whole page, header included, since its title and tabs follow the URL. */
async function Users({ params }: { params: PageProps<"/portal/users/[[...role]]">["params"] }): Promise<ReactElement> {
  const { role: segments } = await params;
  const role = segments ? roleForSlug(segments[0]) : null;
  if (segments && (segments.length > 1 || !role)) notFound();

  const account = await requireAccount(role ? `/portal/users/${ROLE_SLUGS[role]}` : "/portal/users");
  if (!(await isZodeAdmin(account))) notFound();
  const users = await loadUsers();
  const shown = users && role ? users.filter((user) => user.role === role) : users;

  return (
    <div className={styles.page}>
      <PageHeader title={role ? ROLE_LABELS[role] : "Users"} subtitle={SUBTITLES[role ?? "all"]}>
        <nav className={tabs.tabs} aria-label="User types">
          {TABS.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={tabs.tab}
              aria-current={(role ?? "all") === tab.id ? "page" : undefined}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </PageHeader>
      {shown === null ? (
        <Empty>Users couldn&apos;t be loaded right now. Please try again shortly.</Empty>
      ) : shown.length ? (
        <UserList users={shown} selfZosUserId={account.userId} />
      ) : (
        <Empty>{EMPTY[role ?? "all"]}</Empty>
      )}
    </div>
  );
}
