"use client";

import { useActionState, useId, useRef, useState, type ReactElement } from "react";
import { register, type RegisterState } from "./actions";
import { useFocusFirstField } from "./useFocusFirstField";
import {
  MIN_PASSWORD_LENGTH,
  STRENGTH_LABELS,
  checkPassword,
  passwordStrength,
  type PasswordCheck,
  type PasswordStrength,
} from "./password";
import styles from "./auth.module.css";

const INITIAL_STATE: RegisterState = {};

const METER_SEGMENTS = 4;
const FILLED: Record<PasswordStrength, number> = { "too-short": 0, weak: 1, fair: 2, good: 3, strong: 4 };

function PasswordFeedback({
  id,
  checks,
  strength,
}: {
  id: string;
  checks: readonly PasswordCheck[];
  strength: PasswordStrength;
}): ReactElement {
  return (
    <div id={id} className={styles.passwordFeedback}>
      <div className={styles.meter} data-strength={strength} aria-hidden="true">
        {Array.from({ length: METER_SEGMENTS }, (_, i) => (
          <span key={i} data-filled={i < FILLED[strength] || undefined} />
        ))}
      </div>
      <p className={styles.strength} data-strength={strength} aria-live="polite">
        Strength: {STRENGTH_LABELS[strength]}
      </p>
      <ul className={styles.checks}>
        {checks.map((check) => (
          <li key={check.id} data-met={check.met || undefined} data-required={check.required || undefined}>
            <span className={styles.checkMark} aria-hidden="true">
              {check.met ? "✓" : "•"}
            </span>
            {check.label}
            {check.required ? <span className={styles.visuallyHidden}> (required)</span> : null}
            <span className={styles.visuallyHidden}>{check.met ? ", met" : ", not met"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RegisterForm({ next }: { next?: string }): ReactElement {
  const [state, action, pending] = useActionState(register, INITIAL_STATE);
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState(state.values?.email ?? "");
  const feedbackId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstField(formRef, state);

  const checks = checkPassword(password, email);
  const strength = passwordStrength(checks);
  const tooShort = strength === "too-short";

  return (
    <form ref={formRef} action={action} className={styles.form}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className={styles.field}>
        <label className={styles.label} htmlFor="name">
          Name
        </label>
        <input
          id="name"
          name="name"
          autoComplete="name"
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
          onChange={(event) => setEmail(event.target.value)}
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
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={styles.input}
          aria-invalid={password && tooShort ? "true" : undefined}
          aria-describedby={password ? feedbackId : undefined}
        />
        {password ? <PasswordFeedback id={feedbackId} checks={checks} strength={strength} /> : null}
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
