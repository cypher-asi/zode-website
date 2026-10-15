import type { Metadata } from "next";
import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { requireAccount } from "@/features/account/session";
import { findInvite } from "@/features/data-room/invites";
import { JoinInvite } from "@/features/data-room/JoinInvite";
import { normalizeEmail } from "@/features/data-room/rooms";
import { hasSignedMnda } from "@/features/mnda/mndas";
import styles from "@/features/data-room/invite.module.css";

export const metadata: Metadata = {
  title: "Data room invite | ZODE",
  robots: { index: false, follow: false },
};

/**
 * An invite to the signed-in account's email, opened from its portal rather
 * than the emailed link. Anyone else's invite is a 404, so invites don't leak.
 */
export default async function JoinDataRoomPage({
  params,
}: PageProps<"/portal/data-rooms/join/[memberId]">): Promise<ReactElement> {
  const { memberId } = await params;
  const account = await requireAccount(`/portal/data-rooms/join/${memberId}`);
  const invite = await findInvite({ memberId });
  if (!invite || invite.expired || normalizeEmail(account.email) !== invite.email) notFound();

  const needsMnda = invite.requiresMnda && !(await hasSignedMnda(account.userId));
  return (
    <div className={styles.page}>
      <JoinInvite invite={invite} inviteRef={{ memberId }} needsMnda={needsMnda} />
    </div>
  );
}
