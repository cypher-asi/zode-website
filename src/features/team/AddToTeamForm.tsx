"use client";

import { useActionState, type ReactElement } from "react";
import { Select } from "@/components/ui/Select";
import ui from "@/features/data-room/ui.module.css";
import { addToTeamAction, type TeamActionState } from "./actions";
import styles from "./team.module.css";

const INITIAL_STATE: TeamActionState = {};

export interface Candidate {
  id: number;
  label: string;
  detail?: string;
}

/** Puts someone who already has an account on the team, without emailing them. */
export function AddToTeamForm({ candidates }: { candidates: Candidate[] }): ReactElement {
  const [state, action, pending] = useActionState(addToTeamAction, INITIAL_STATE);
  const options = candidates.map((c) => ({ value: String(c.id), label: c.label, detail: c.detail }));

  return (
    <form action={action} className={styles.form}>
      <label id="team-add-label" htmlFor="team-add" className={ui.label}>
        Add an existing account
      </label>
      <div className={styles.formRow}>
        <Select
          id="team-add"
          aria-labelledby="team-add-label"
          name="userId"
          className={styles.grow}
          options={options}
          defaultValue={options[0]?.value}
          disabled={!options.length}
        />
        <button type="submit" className={ui.button} disabled={pending || !options.length}>
          {pending ? "Adding…" : "Add to team"}
        </button>
      </div>
      {state.error ? (
        <p className={ui.error} role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
