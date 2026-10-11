"use client";

import { useActionState, useState, type ReactElement } from "react";
import { createRoomAction } from "./actions";
import type { ActionState } from "./types";
import ui from "./ui.module.css";
import styles from "./portal.module.css";

/** "New data room" in the portal; expands into a name field, and the creator becomes its admin. */
export function NewRoomForm(): ReactElement {
  const [open, setOpen] = useState(false);
  const [state, create, pending] = useActionState<ActionState, FormData>(createRoomAction, {});

  if (!open) {
    return (
      <button type="button" className={ui.button} onClick={() => setOpen(true)}>
        New data room
      </button>
    );
  }

  return (
    <form action={create} className={styles.newRoom}>
      <input
        name="name"
        className={ui.input}
        placeholder="Room name, e.g. Project Atlas diligence"
        aria-label="Data room name"
        maxLength={200}
        required
        autoFocus
      />
      <button type="submit" className={ui.primary} disabled={pending}>
        {pending ? "Creating…" : "Create"}
      </button>
      <button type="button" className={ui.button} onClick={() => setOpen(false)}>
        Cancel
      </button>
      {state.error ? <p className={ui.error}>{state.error}</p> : null}
    </form>
  );
}
