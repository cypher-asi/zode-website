import type { Metadata } from "next";
import type { ReactElement } from "react";
import Link from "next/link";
import { LogoutButton } from "@/features/account/LogoutButton";
import { getAccount } from "@/features/account/session";
import { AcceptInvite } from "@/features/data-room/AcceptInvite";
import { findInvite } from "@/features/data-room/invites";
import { normalizeEmail } from "@/features/data-room/rooms";
import { SignMndaToJoin } from "@/features/data-room/SignMndaToJoin";
import { AgreementText } from "@/features/mnda/AgreementText";
import { hasSignedMnda } from "@/features/mnda/mndas";
import styles from "@/features/data-room/invite.module.css";
import ui from "@/features/data-room/ui.module.css";

export const metadata: Metadata = {
  title: "Data room invite | ZODE",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const instant = false;

/**
 * Where invite emails land. Signed-out invitees log in or register and come
 * back here; the invite is accepted only by the account with the invited email.
 */
export default async function DataRoomInvitePage({
  params,
}: PageProps<"/data-rooms/invite/[token]">): Promise<ReactElement> {
  const { token } = await params;
  const [invite, account] = await Promise.all([findInvite(token), getAccount()]);
  const here = `/data-rooms/invite/${token}`;

  let body: ReactElement;
  let wide = false;
  if (!invite) {
    body = (
      <>
        <h1 className={styles.title}>This invite link isn&apos;t valid</h1>
        <p className={styles.text}>
          It may have been used already, revoked, or replaced by a newer invite. If you already joined, find the room in
          your portal.
        </p>
        <Link className={ui.primary} href={account ? "/portal" : `/login?next=${encodeURIComponent("/portal")}`}>
          {account ? "Go to your portal" : "Log in"}
        </Link>
      </>
    );
  } else if (invite.expired) {
    body = (
      <>
        <h1 className={styles.title}>This invite has expired</h1>
        <p className={styles.text}>
          Ask {invite.invitedBy ?? "the room's admin"} to resend your invite to <strong>{invite.email}</strong>.
        </p>
      </>
    );
  } else {
    const intro = (
      <>
        <p className={styles.eyebrow}>Data room invite</p>
        <h1 className={styles.title}>{invite.roomName}</h1>
        <p className={styles.text}>
          {invite.invitedBy ? <strong>{invite.invitedBy}</strong> : "An admin"} invited <strong>{invite.email}</strong>{" "}
          to this data room as {invite.role === "admin" ? "an Admin" : "a Viewer"}.
        </p>
      </>
    );
    if (!account) {
      const next = encodeURIComponent(here);
      body = (
        <>
          {intro}
          <p className={styles.text}>Log in, or create a free ZODE account, with {invite.email} to open it.</p>
          <div className={styles.actions}>
            <Link className={ui.primary} href={`/login?next=${next}`}>
              Log in
            </Link>
            <Link className={ui.button} href={`/register?next=${next}`}>
              Create an account
            </Link>
          </div>
        </>
      );
    } else if (normalizeEmail(account.email) !== invite.email) {
      body = (
        <>
          {intro}
          <p className={styles.warning}>
            You&apos;re signed in as <strong>{account.email}</strong>. Log out, then sign in or register with{" "}
            <strong>{invite.email}</strong> to accept.
          </p>
          <div className={styles.actions}>
            <LogoutButton className={ui.button} />
          </div>
        </>
      );
    } else if (invite.requiresMnda && !(await hasSignedMnda(account.userId))) {
      wide = true;
      body = (
        <>
          {intro}
          <p className={styles.text}>
            Before the room opens, sign ZODE&apos;s mutual nondisclosure agreement for the entity you represent. ZODE
            countersigns right away and you get the executed copy by email. Views and downloads in data rooms are
            recorded for the room&apos;s admins.
          </p>
          <AgreementText />
          <SignMndaToJoin token={token} email={invite.email} />
        </>
      );
    } else {
      body = (
        <>
          {intro}
          <p className={styles.text}>Views and downloads in data rooms are recorded for the room&apos;s admins.</p>
          <AcceptInvite token={token} />
        </>
      );
    }
  }

  return (
    <div className={styles.page}>
      <div className={wide ? `${styles.card} ${styles.wide}` : styles.card}>{body}</div>
    </div>
  );
}
