"use client";

import { useActionState, type ReactElement } from "react";
import { register, type RegisterState } from "./actions";
import styles from "../login/auth.module.css";

const INITIAL_STATE: RegisterState = {};

export function RegisterForm({ next }: { next?: string }): ReactElement {
  const [state, action, pending] = useActionState(register, INITIAL_STATE);

  return (
    <form action={action} className={styles.form}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className={styles.field}>
        <label className={styles.label} htmlFor="name">
          Name
        </label>
        <input
          id="name"
          name="name"
          autoComplete="name"
          autoFocus
          required
          maxLength={120}
          defaultValue={state.values?.name}
          className={styles.input}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email}
          className={styles.input}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={styles.input}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="inviteCode">
          Invite code <span className={styles.optional}>(optional)</span>
        </label>
        <input
          id="inviteCode"
          name="inviteCode"
          autoComplete="off"
          defaultValue={state.values?.inviteCode}
          className={styles.input}
        />
      </div>
      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
