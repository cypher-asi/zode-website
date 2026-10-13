import type { ReactElement } from "react";
import { PortalIcon } from "@/features/portal/icons";
import styles from "@/features/portal/portal.module.css";
import { ROLE_LABELS, type User } from "@/features/users/types";
import type { PendingTeamInvite } from "./invites";
import { PendingInviteButtons, RemoveFromTeamButton } from "./TeamButtons";

const date = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

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

/** Team invites not yet accepted, with Resend and Revoke. */
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
                {invite.invitedBy ? ` by ${invite.invitedBy}` : ""}
              </span>
            </span>
            <span className={styles.rowEnd}>
              <span className={styles.pill}>{invite.expired ? "Expired" : "Pending"}</span>
              <PendingInviteButtons inviteId={invite.id} />
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
