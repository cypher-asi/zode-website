"use client";

import { useActionState, type ReactElement } from "react";
import { unlock, type UnlockState } from "./actions";
import styles from "./unlock.module.css";

const INITIAL_STATE: UnlockState = {};

export function UnlockForm(): ReactElement {
  const [state, action, pending] = useActionState(unlock, INITIAL_STATE);

  return (
    <form action={action} className={styles.form}>
      <label className={styles.label} htmlFor="password">
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        autoFocus
        required
        className={styles.input}
        aria-invalid={state.error ? "true" : undefined}
        aria-describedby={state.error ? "password-error" : undefined}
      />
      {state.error ? (
        <p id="password-error" className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? "Entering…" : "Enter"}
      </button>
    </form>
  );
}
