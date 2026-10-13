"use client";

import { useActionState, useOptimistic, useState, useTransition, type ReactElement } from "react";
import { Select } from "@/components/ui/Select";
import {
  changeRoleAction,
  changeRoomKindAction,
  deleteRoomAction,
  removeMemberAction,
  renameRoomAction,
  resendInviteAction,
} from "./actions";
import { Dialog, type DialogProps } from "./Dialog";
import {
  ROLES,
  ROOM_KINDS,
  leaseEconomics,
  roomKindLabel,
  type ActionState,
  type RoomKind,
  type RoomMember,
  type RoomRole,
} from "./types";
import styles from "./admin.module.css";
import ui from "./ui.module.css";

const date = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

const ROLE_OPTIONS = ROLES.map((role) => ({ value: role.id, label: role.label, detail: role.detail }));
const KIND_OPTIONS = ROOM_KINDS.map((kind) => ({ value: kind.id, label: kind.label, detail: kind.detail }));

const STATUS_LABELS: Record<RoomMember["status"], string> = {
  active: "Active",
  pending: "Invite sent",
  expired: "Invite expired",
};

interface MembersPanelProps {
  roomId: string;
  roomName: string;
  roomKind: RoomKind;
  /** The room has a diligence summary, whose economics a change to or from a purchase discards. */
  hasSummary: boolean;
  members: RoomMember[];
  selfEmail: string;
}

export function MembersPanel({ roomId, roomName, roomKind, hasSummary, members, selfEmail }: MembersPanelProps): ReactElement {
  const [renameState, rename, renaming] = useActionState(renameRoomAction.bind(null, roomId), {});
  const [kindState, setKindState] = useState<ActionState>({});
  const [kind, setKind] = useOptimistic(roomKind);
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

  const applyKind = (to: RoomKind) =>
    startTransition(async () => {
      setKind(to);
      setKindState(await changeRoomKindAction(roomId, to));
    });

  const chooseKind = (to: RoomKind) => {
    if (to === roomKind) return;
    if (!hasSummary || leaseEconomics(to) === leaseEconomics(roomKind)) {
      applyKind(to);
      return;
    }
    setDialog({
      title: `Change to ${roomKindLabel(to)}?`,
      description: `This room's summary was written for a ${roomKindLabel(roomKind).toLowerCase()}, so changing the type removes it. Write it again for the new type with scripts/write-room-summary.mjs.`,
      confirmLabel: "Change type",
      danger: true,
      onConfirm: async () => {
        const result = await changeRoomKindAction(roomId, to);
        setKindState(result);
        return result.error;
      },
    });
  };

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
            {member.superAdmin ? <span className={styles.you}>Super admin</span> : null}
          </span>
          <span className={styles.memberMeta}>
            <span className={styles.status} data-status={member.status}>
              {STATUS_LABELS[member.status]}
            </span>
            {member.status !== "active" && member.requiresMnda ? (
              <span className={styles.status} data-status="mnda">
                MNDA required
              </span>
            ) : null}
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

        <div className={ui.field}>
          <label htmlFor="room-kind" className={ui.label}>
            Room type
          </label>
          <Select
            id="room-kind"
            options={KIND_OPTIONS}
            value={kind}
            disabled={pending}
            onChange={(value) => chooseKind(value as RoomKind)}
          />
        </div>
        {kindState.error ? <p className={ui.error}>{kindState.error}</p> : null}
        {kindState.ok ? <p className={ui.ok}>{kindState.ok}</p> : null}

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
