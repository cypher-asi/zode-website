"use client";

import { useActionState, useEffect, type ReactElement } from "react";
import { accountCookiesChanged } from "@/features/account/useAccount";
import ui from "@/features/data-room/ui.module.css";
import { updateNameAction, type NameState } from "./actions";
import styles from "./settings.module.css";

const INITIAL_STATE: NameState = {};

export function NameForm({ name }: { name: string }): ReactElement {
  const [state, action, pending] = useActionState(updateNameAction, INITIAL_STATE);

  // The action rewrote the initials cookie; the header avatar reads it.
  useEffect(() => {
    if (state.saved) accountCookiesChanged();
  }, [state]);

  return (
    <form action={action} className={styles.nameForm}>
      <label className={ui.label} htmlFor="settings-name">
        Name
      </label>
      <div className={styles.nameRow}>
        <input
          id="settings-name"
          name="name"
          autoComplete="name"
          required
          maxLength={120}
          defaultValue={state.name ?? name}
          className={ui.input}
        />
        <button type="submit" className={ui.primary} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      {state.error ? (
        <p className={ui.error} role="alert">
          {state.error}
        </p>
      ) : state.saved && !pending ? (
        <p className={ui.ok} role="status">
          Saved.
        </p>
      ) : null}
    </form>
  );
}
