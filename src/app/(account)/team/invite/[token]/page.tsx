import type { Metadata } from "next";
import type { ReactElement } from "react";
import Link from "next/link";
import { LogoutButton } from "@/features/account/LogoutButton";
import { getAccount } from "@/features/account/session";
import { normalizeEmail } from "@/features/data-room/rooms";
import styles from "@/features/data-room/invite.module.css";
import ui from "@/features/data-room/ui.module.css";
import { AcceptTeamInvite } from "@/features/team/AcceptTeamInvite";
import { findTeamInvite } from "@/features/team/invites";

export const metadata: Metadata = {
  title: "Team invite | ZODE",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Where team invite emails land. Signed-out invitees log in or register and
 * come back here; the invite is accepted only by the account with the invited email.
 */
export default async function TeamInvitePage({ params }: PageProps<"/team/invite/[token]">): Promise<ReactElement> {
  const { token } = await params;
  const [invite, account] = await Promise.all([findTeamInvite(token), getAccount()]);
  const here = `/team/invite/${token}`;

  let body: ReactElement;
  if (!invite) {
    body = (
      <>
        <h1 className={styles.title}>This invite link isn&apos;t valid</h1>
        <p className={styles.text}>
          It may have been used already, revoked, or replaced by a newer invite. If you already joined, the team is in
          your portal&apos;s settings.
        </p>
        <Link className={ui.primary} href={account ? "/portal/settings/team" : `/login?next=${encodeURIComponent("/portal")}`}>
          {account ? "Go to your portal" : "Log in"}
        </Link>
      </>
    );
  } else if (invite.expired) {
    body = (
      <>
        <h1 className={styles.title}>This invite has expired</h1>
        <p className={styles.text}>
          Ask {invite.invitedBy ?? "a ZODE super admin"} to resend your invite to <strong>{invite.email}</strong>.
        </p>
      </>
    );
  } else {
    const intro = (
      <>
        <p className={styles.eyebrow}>Team invite</p>
        <h1 className={styles.title}>Join the ZODE team</h1>
        <p className={styles.text}>
          {invite.invitedBy ? <strong>{invite.invitedBy}</strong> : "A super admin"} invited{" "}
          <strong>{invite.email}</strong> to the ZODE team.
        </p>
      </>
    );
    if (!account) {
      const next = encodeURIComponent(here);
      body = (
        <>
          {intro}
          <p className={styles.text}>Log in, or create a free ZODE account, with {invite.email} to join.</p>
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
    } else {
      body = (
        <>
          {intro}
          <AcceptTeamInvite token={token} />
        </>
      );
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>{body}</div>
    </div>
  );
}
