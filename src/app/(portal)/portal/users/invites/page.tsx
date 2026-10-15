import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { notFound } from "next/navigation";
import { isZodeAdmin } from "@/features/account/admin";
import { requireAccount } from "@/features/account/session";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { Empty } from "@/features/portal/sections";
import { listPendingTeamInvites, type PendingTeamInvite } from "@/features/team/invites";
import { PendingTeamInvites } from "@/features/team/TeamList";
import styles from "@/features/portal/portal.module.css";

export const metadata: Metadata = {
  title: "Invites | ZODE",
  robots: { index: false, follow: false },
};

/** Invites not yet accepted, Regular and Team alike, with Resend and Revoke. Super admins only. The layout holds the header. */
export default function UserInvitesPage(): ReactElement {
  return (
    <Suspense fallback={<PortalLoading header={false} nested />}>
      <Invites />
    </Suspense>
  );
}

async function Invites(): Promise<ReactElement> {
  const account = await requireAccount("/portal/users/invites");
  if (!(await isZodeAdmin(account))) notFound();
  const invites = await listPendingTeamInvites().catch((error: unknown): PendingTeamInvite[] | null => {
    console.error("[users] couldn't load invites", error);
    return null;
  });

  return (
    <section className={styles.section} aria-label="Invites">
      {invites === null ? (
        <Empty>Invites couldn&apos;t be loaded right now. Please try again shortly.</Empty>
      ) : invites.length ? (
        <PendingTeamInvites invites={invites} />
      ) : (
        <Empty>No pending invites. Use Invite to add people.</Empty>
      )}
    </section>
  );
}
