"use client";

import { useActionState, useOptimistic, useState, useTransition, type ReactElement } from "react";
import { Select } from "@/components/ui/Select";
import {
  changeRoleAction,
  deleteRoomAction,
  inviteMembersAction,
  removeMemberAction,
  renameRoomAction,
  resendInviteAction,
} from "./actions";
import { Dialog, type DialogProps } from "./Dialog";
import { ROLES, type ActionState, type RoomMember, type RoomRole } from "./types";
import styles from "./admin.module.css";
import ui from "./ui.module.css";

const date = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

const ROLE_OPTIONS = ROLES.map((role) => ({ value: role.id, label: role.label, detail: role.detail }));

const STATUS_LABELS: Record<RoomMember["status"], string> = {
  active: "Active",
  pending: "Invite sent",
  expired: "Invite expired",
};

interface MembersPanelProps {
  roomId: string;
  roomName: string;
  members: RoomMember[];
  selfEmail: string;
}

export function MembersPanel({ roomId, roomName, members, selfEmail }: MembersPanelProps): ReactElement {
  const [inviteState, invite, inviting] = useActionState(inviteMembersAction.bind(null, roomId), {});
  const [renameState, rename, renaming] = useActionState(renameRoomAction.bind(null, roomId), {});
  const [rowState, setRowState] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();
  const [roles, setRole] = useOptimistic<Partial<Record<string, RoomRole>>, [string, RoomRole]>(
    {},
    (state, [id, role]) => ({ ...state, [id]: role }),
  );
  const [dialog, setDialog] = useState<Omit<DialogProps, "onClose"> | null>(null);

  const run = (action: () => Promise<ActionState>) =>
    startTransition(async () => {
      setRowState(await action());
    });

  const active = members.filter((m) => m.status === "active");
  const invited = members.filter((m) => m.status !== "active");

  const row = (member: RoomMember) => {
    const self = member.email === selfEmail;
    return (
      <li key={member.id} className={styles.member}>
        <span className={styles.avatar} aria-hidden="true">
          {member.email.slice(0, 1).toUpperCase()}
        </span>
        <div className={styles.memberMain}>
          <span className={styles.memberEmail}>
            {member.email}
            {self ? <span className={styles.you}>You</span> : null}
          </span>
          <span className={styles.memberMeta}>
            <span className={styles.status} data-status={member.status}>
              {STATUS_LABELS[member.status]}
            </span>
            {member.status === "active" && member.acceptedAt
              ? `Joined ${date.format(new Date(member.acceptedAt))}`
              : `Invited ${date.format(new Date(member.invitedAt))}${member.invitedBy ? ` by ${member.invitedBy}` : ""}`}
          </span>
        </div>
        <Select
          size="sm"
          align="end"
          className={styles.roleSelect}
          options={ROLE_OPTIONS}
          value={roles[member.id] ?? member.role}
          aria-label={`Role for ${member.email}`}
          onChange={(value) => {
            const role = value as RoomRole;
            startTransition(async () => {
              setRole([member.id, role]);
              setRowState(await changeRoleAction(roomId, member.id, role));
            });
          }}
        />
        <div className={styles.memberActions}>
          {member.status !== "active" ? (
            <button
              type="button"
              className={ui.button}
              disabled={pending}
              onClick={() => run(() => resendInviteAction(roomId, member.id))}
            >
              Resend
            </button>
          ) : null}
          <button
            type="button"
            className={ui.button}
            disabled={pending}
            onClick={() =>
              setDialog({
                title: member.status === "active" ? (self ? "Leave this room?" : `Remove ${member.email}?`) : "Revoke invite?",
                description:
                  member.status === "active"
                    ? `${self ? "You" : "They"} lose access to every file in ${roomName} immediately.`
                    : `The link sent to ${member.email} stops working.`,
                confirmLabel: member.status === "active" ? (self ? "Leave" : "Remove") : "Revoke",
                danger: true,
                onConfirm: async () => {
                  const result = await removeMemberAction(roomId, member.id);
                  setRowState(result);
                  return result.error;
                },
              })
            }
          >
            {member.status === "active" ? (self ? "Leave" : "Remove") : "Revoke"}
          </button>
        </div>
      </li>
    );
  };

  return (
    <div className={styles.stack}>
      <section className={styles.card} aria-labelledby="invite-heading">
        <h2 id="invite-heading" className={styles.heading}>
          Invite people
        </h2>
        <p className={styles.lede}>
          Anyone can be invited by email. They get a personal link and sign in, or create a ZODE account, with that
          address to get in.
        </p>
        <form action={invite} className={styles.inviteForm}>
          <label className={ui.field}>
            <span className={ui.label}>Emails</span>
            <textarea
              name="emails"
              className={ui.textarea}
              placeholder="name@company.com, another@company.com"
              rows={2}
              required
            />
          </label>
          <fieldset className={styles.roles}>
            <legend className={ui.label}>Access</legend>
            {ROLES.map((role) => (
              <label key={role.id} className={styles.roleOption}>
                <input type="radio" name="role" value={role.id} defaultChecked={role.id === "viewer"} />
                <span>
                  <strong>{role.label}</strong>
                  <span>{role.detail}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className={styles.formFooter}>
            {inviteState.error ? <p className={ui.error}>{inviteState.error}</p> : null}
            {inviteState.ok ? <p className={ui.ok}>{inviteState.ok}</p> : null}
            <button type="submit" className={ui.primary} disabled={inviting}>
              {inviting ? "Sending…" : "Send invites"}
            </button>
          </div>
        </form>
      </section>

      <section className={styles.card} aria-labelledby="people-heading">
        <h2 id="people-heading" className={styles.heading}>
          People with access <span className={styles.countBadge}>{active.length}</span>
        </h2>
        {rowState.error ? <p className={ui.error}>{rowState.error}</p> : null}
        {rowState.ok ? <p className={ui.ok}>{rowState.ok}</p> : null}
        <ul className={styles.members}>{active.map(row)}</ul>
        {invited.length ? (
          <>
            <h3 className={styles.subheading}>Pending invites</h3>
            <ul className={styles.members}>{invited.map(row)}</ul>
          </>
        ) : null}
      </section>

      <section className={styles.card} aria-labelledby="settings-heading">
        <h2 id="settings-heading" className={styles.heading}>
          Room settings
        </h2>
        <form action={rename} className={styles.inline}>
          <label className={ui.field} style={{ flex: 1 }}>
            <span className={ui.label}>Room name</span>
            <input name="name" className={ui.input} defaultValue={roomName} maxLength={200} required />
          </label>
          <button type="submit" className={ui.button} disabled={renaming}>
            {renaming ? "Saving…" : "Rename"}
          </button>
        </form>
        {renameState.error ? <p className={ui.error}>{renameState.error}</p> : null}
        {renameState.ok ? <p className={ui.ok}>{renameState.ok}</p> : null}

        <div className={styles.dangerZone}>
          <div>
            <strong>Delete this data room</strong>
            <p>Every file, folder, member and activity record is removed permanently.</p>
          </div>
          <button
            type="button"
            className={ui.button}
            onClick={() =>
              setDialog({
                title: `Delete ${roomName}?`,
                description: "This can't be undone. Type the room's name to confirm.",
                input: { label: "Room name", initial: "" },
                confirmLabel: "Delete room",
                danger: true,
                onConfirm: async (value) => {
                  const form = new FormData();
                  form.set("confirm", value);
                  return (await deleteRoomAction(roomId, {}, form)).error;
                },
              })
            }
          >
            Delete room
          </button>
        </div>
      </section>

      {dialog ? <Dialog {...dialog} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
