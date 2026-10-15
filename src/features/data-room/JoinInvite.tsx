import type { ReactElement } from "react";
import { AgreementText } from "@/features/mnda/AgreementText";
import { AcceptInvite } from "./AcceptInvite";
import type { InviteDetails } from "./invites";
import { SignMndaToJoin } from "./SignMndaToJoin";
import type { InviteRef } from "./types";
import styles from "./invite.module.css";

/** Who invited whom to which room, atop every state of the invite card. */
export function InviteIntro({ invite }: { invite: InviteDetails }): ReactElement {
  return (
    <>
      <p className={styles.eyebrow}>Data room invite</p>
      <h1 className={styles.title}>{invite.roomName}</h1>
      <p className={styles.text}>
        {invite.invitedBy ? <strong>{invite.invitedBy}</strong> : "An admin"} invited <strong>{invite.email}</strong> to
        this data room as {invite.role === "admin" ? "an Admin" : "a Viewer"}.
      </p>
    </>
  );
}

/**
 * The invite card for the invited, signed-in account: sign the MNDA and join
 * when it still has to, widened for the agreement, otherwise just accept.
 */
export function JoinInvite({
  invite,
  inviteRef,
  needsMnda,
}: {
  invite: InviteDetails;
  inviteRef: InviteRef;
  needsMnda: boolean;
}): ReactElement {
  return (
    <div className={needsMnda ? `${styles.card} ${styles.wide}` : styles.card}>
      <InviteIntro invite={invite} />
      {needsMnda ? (
        <>
          <p className={styles.text}>
            Before the room opens, sign ZODE&apos;s mutual nondisclosure agreement for the entity you represent. ZODE
            countersigns right away and you get the executed copy by email. Views and downloads in data rooms are
            recorded for the room&apos;s admins.
          </p>
          <AgreementText />
          <SignMndaToJoin invite={inviteRef} email={invite.email} />
        </>
      ) : (
        <>
          <p className={styles.text}>Views and downloads in data rooms are recorded for the room&apos;s admins.</p>
          <AcceptInvite invite={inviteRef} />
        </>
      )}
    </div>
  );
}
