"use client";

import { useActionState, type ReactElement } from "react";
import { login, type AuthFormState } from "./actions";
import styles from "./auth.module.css";

const INITIAL_STATE: AuthFormState = {};

export function LoginForm({ next }: { next?: string }): ReactElement {
  const [state, action, pending] = useActionState(login, INITIAL_STATE);

  return (
    <form action={action} className={styles.form}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className={styles.field}>
        <label className={styles.label} htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          defaultValue={state.email}
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
          autoComplete="current-password"
          required
          className={styles.input}
          aria-invalid={state.error ? "true" : undefined}
          aria-describedby={state.error ? "login-error" : undefined}
        />
      </div>
      {state.error ? (
        <p id="login-error" className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
