"use client";

import { useActionState, useOptimistic, useState, useTransition, type ReactElement } from "react";
import { Select } from "@/components/ui/Select";
import { changeRoomKindAction, deleteRoomAction, renameRoomAction } from "./actions";
import { Dialog, type DialogProps } from "./Dialog";
import { ROOM_KINDS, leaseEconomics, roomKindLabel, type ActionState, type RoomKind } from "./types";
import styles from "./admin.module.css";
import ui from "./ui.module.css";

const KIND_OPTIONS = ROOM_KINDS.map((kind) => ({ value: kind.id, label: kind.label, detail: kind.detail }));

interface RoomSettingsPanelProps {
  roomId: string;
  roomName: string;
  roomKind: RoomKind;
  /** The room has a diligence summary, whose economics a change to or from a purchase discards. */
  hasSummary: boolean;
}

export function RoomSettingsPanel({ roomId, roomName, roomKind, hasSummary }: RoomSettingsPanelProps): ReactElement {
  const [renameState, rename, renaming] = useActionState(renameRoomAction.bind(null, roomId), {});
  const [kindState, setKindState] = useState<ActionState>({});
  const [kind, setKind] = useOptimistic(roomKind);
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<Omit<DialogProps, "onClose"> | null>(null);

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

  return (
    <div className={styles.stack}>
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
