"use client";

import { useActionState, type ReactElement } from "react";
import ui from "@/features/data-room/ui.module.css";
import { inviteTeamAction, type TeamActionState } from "./actions";
import styles from "./team.module.css";

const INITIAL_STATE: TeamActionState = {};

/** Emails a team invite to each address; they join once they sign in with it. */
export function InviteTeamForm(): ReactElement {
  const [state, action, pending] = useActionState(inviteTeamAction, INITIAL_STATE);

  return (
    <form action={action} className={styles.form}>
      <label className={ui.label} htmlFor="team-invite-emails">
        Invite by email
      </label>
      <div className={styles.formRow}>
        <input
          id="team-invite-emails"
          name="emails"
          type="text"
          inputMode="email"
          autoComplete="off"
          placeholder="name@example.com, another@example.com"
          required
          className={ui.input}
        />
        <button type="submit" className={ui.primary} disabled={pending}>
          {pending ? "Sending…" : "Send invites"}
        </button>
      </div>
      {state.error ? (
        <p className={ui.error} role="alert">
          {state.error}
        </p>
      ) : state.ok && !pending ? (
        <p className={ui.ok} role="status">
          {state.ok}
        </p>
      ) : null}
    </form>
  );
}
