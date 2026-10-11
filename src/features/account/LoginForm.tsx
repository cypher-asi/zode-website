"use client";

import { useActionState, useRef, useState, type ReactElement } from "react";
import { login, type AuthFormState } from "./actions";
import { AccountPicker } from "./AccountPicker";
import { forgetAccount } from "./rememberedAccounts";
import { useFocusFirstField } from "./useFocusFirstField";
import { useRememberedAccounts } from "./useRememberedAccounts";
import styles from "./auth.module.css";

const INITIAL_STATE: AuthFormState = {};

const sameEmail = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

export function LoginForm({ next }: { next?: string }): ReactElement {
  const [state, action, pending] = useActionState(login, INITIAL_STATE);
  const accounts = useRememberedAccounts();
  /** "Use another account" was chosen, so the email field shows even with accounts saved. */
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // The picked account, else the one just tried, else the most recent; a removed one falls through to the next.
  const preferred = picked ?? state.email;
  const selected = adding
    ? undefined
    : ((preferred ? accounts.find((account) => sameEmail(account.email, preferred)) : undefined) ?? accounts[0]);
  // Blank after "Use another account", rather than the saved address that was just tried.
  const tried = state.email;
  const typedEmail = tried && accounts.some((account) => sameEmail(account.email, tried)) ? undefined : tried;
  useFocusFirstField(formRef, state, selected?.email);

  const select = (email: string) => {
    if (passwordRef.current && selected && !sameEmail(email, selected.email)) passwordRef.current.value = "";
    setPicked(email);
    setAdding(false);
  };

  return (
    <form ref={formRef} action={action} className={styles.form}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {selected ? (
        <div className={styles.field}>
          <span className={styles.label}>Account</span>
          <AccountPicker
            accounts={accounts}
            selected={selected}
            onSelect={select}
            onAdd={() => setAdding(true)}
            onRemove={forgetAccount}
          />
          {/* Submits the email, and lets password managers match the saved login. */}
          <input
            className={styles.visuallyHidden}
            name="email"
            type="email"
            autoComplete="username"
            value={selected.email}
            readOnly
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>
      ) : (
        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label className={styles.label} htmlFor="email">
              Email
            </label>
            {accounts.length ? (
              <button type="button" className={styles.labelAction} onClick={() => setAdding(false)}>
                Choose a saved account
              </button>
            ) : null}
          </div>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={typedEmail}
            className={styles.input}
          />
        </div>
      )}
      <div className={styles.field}>
        <label className={styles.label} htmlFor="password">
          Password
        </label>
        <input
          ref={passwordRef}
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
