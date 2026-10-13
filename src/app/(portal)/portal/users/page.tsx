import type { Metadata } from "next";
import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { isZodeAdmin } from "@/features/account/admin";
import { requireAccount } from "@/features/account/session";
import { loadUsers } from "@/features/portal/data";
import { Empty, PageHeader, UserList } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";

export const metadata: Metadata = {
  title: "Users | ZODE",
  robots: { index: false, follow: false },
};

/** Every account that has signed in, by ZODE user id, and their site-wide role. Super admins only. */
export default async function UsersPage(): Promise<ReactElement> {
  const account = await requireAccount("/portal/users");
  if (!(await isZodeAdmin(account))) notFound();
  const users = await loadUsers();

  return (
    <div className={styles.page}>
      <PageHeader
        title="Users"
        subtitle="Everyone who has signed in, numbered by ZODE user id. Accounts are Regular unless a super admin puts them on the Team or makes them a super admin."
      />
      {users === null ? (
        <Empty>Users couldn&apos;t be loaded right now. Please try again shortly.</Empty>
      ) : users.length ? (
        <UserList users={users} selfZosUserId={account.userId} />
      ) : (
        <Empty>No one has signed in yet.</Empty>
      )}
    </div>
  );
}
