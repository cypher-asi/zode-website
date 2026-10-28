import type { ReactElement } from "react";
import { InfoTip, type InfoTipRow } from "@/components/ui/InfoTip";
import { PortalIcon } from "@/features/portal/icons";
import styles from "@/features/portal/portal.module.css";
import { ROLE_LABELS, type User } from "@/features/users/types";
import type { PendingTeamInvite } from "./invites";
import { PendingInviteButtons, RemoveFromTeamButton } from "./TeamButtons";

const date = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

function teamInviteHistory(invite: PendingTeamInvite): InfoTipRow[] {
  const rows: (InfoTipRow | null)[] = [
    invite.invitedBy ? { label: "Invited by", value: invite.invitedBy } : null,
    { label: "Sent", date: invite.invitedAt },
    invite.expiresAt ? { label: invite.expired ? "Expired" : "Expires", date: invite.expiresAt } : null,
    { label: "Grants", value: ROLE_LABELS[invite.role] },
  ];
  return rows.filter((row) => row !== null);
}

/** The team, with Remove on each Team row for super admins. Super admins are changed on the Users page. */
export function TeamList({
  team,
  selfZosUserId,
  manage,
}: {
  team: User[];
  selfZosUserId: string;
  manage: boolean;
}): ReactElement {
  return (
    <ul className={styles.list}>
      {team.map((user) => {
        const self = user.zosUserId === selfZosUserId;
        const label = user.name || user.email || `user #${user.id}`;
        return (
          <li key={user.id}>
            <div className={styles.row} data-actions="">
              <span className={styles.rowIcon}>
                <PortalIcon name="person" />
              </span>
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>{label}</span>
                <span className={styles.rowMeta}>
                  {user.email && user.email !== label ? `${user.email} · ` : ""}
                  {user.lastSeenAt ? `Last seen ${date.format(user.lastSeenAt)}` : "Not seen yet"}
                </span>
              </span>
              <span className={styles.rowEnd}>
                {self ? <span className={styles.pill}>You</span> : null}
                <span className={styles.pill} data-strong={user.role === "super_admin" ? "" : undefined}>
                  {ROLE_LABELS[user.role]}
                </span>
                {manage && !self && user.role === "team" ? <RemoveFromTeamButton userId={user.id} label={label} /> : null}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Invites not yet accepted, with the role each grants, and Resend and Revoke. */
export function PendingTeamInvites({ invites }: { invites: PendingTeamInvite[] }): ReactElement {
  return (
    <ul className={styles.list}>
      {invites.map((invite) => (
        <li key={invite.id}>
          <div className={styles.row} data-actions="">
            <span className={styles.rowIcon}>
              <PortalIcon name="person" />
            </span>
            <span className={styles.rowMain}>
              <span className={styles.rowTitle}>{invite.email}</span>
              <span className={styles.rowMeta}>
                {invite.expired ? "Expired" : "Invited"} {date.format(invite.invitedAt)}
                {invite.invitedBy ? ` by ${invite.invitedBy}` : ""}{" "}
                <InfoTip rows={teamInviteHistory(invite)} label={`Invite details for ${invite.email}`} />
              </span>
            </span>
            <span className={styles.rowEnd}>
              <span className={styles.pill}>{invite.expired ? "Expired" : "Pending"}</span>
              <span className={styles.pill}>{ROLE_LABELS[invite.role]}</span>
              <PendingInviteButtons inviteId={invite.id} />
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
