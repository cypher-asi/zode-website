"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type ReactElement } from "react";
import { Select } from "@/components/ui/Select";
import { deleteGoalAction, saveGoalAction, type GoalFormState } from "./actions";
import { ANALYTICS_EVENTS } from "./events";
import styles from "./analytics.module.css";

const KINDS = [
  { value: "event", label: "Event" },
  { value: "path", label: "Page visited" },
];

const EVENT_OPTIONS = Object.entries(ANALYTICS_EVENTS).map(([value, event]) => ({ value, label: event.label }));

/** Adds a goal: an event from the registry, or a pageview whose path matches a pattern. */
export function GoalForm(): ReactElement {
  const [state, action, pending] = useActionState<GoalFormState, FormData>(saveGoalAction, {});
  const [kind, setKind] = useState("event");
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} className={styles.goalForm} action={action}>
      <div className={styles.goalField}>
        <label className={styles.goalLabel} htmlFor="goal-label">
          Name
        </label>
        <input id="goal-label" className={styles.goalInput} name="label" placeholder="e.g. Read a news post" required maxLength={80} />
      </div>
      <div className={styles.goalField}>
        <span className={styles.goalLabel} id="goal-kind-label">
          Completed by
        </span>
        <Select options={KINDS} value={kind} onChange={setKind} name="matchKind" size="sm" aria-labelledby="goal-kind-label" />
      </div>
      <div className={styles.goalField}>
        {kind === "event" ? (
          <>
            <span className={styles.goalLabel} id="goal-event-label">
              Event
            </span>
            <Select options={EVENT_OPTIONS} defaultValue={EVENT_OPTIONS[0].value} name="match" size="sm" aria-labelledby="goal-event-label" />
          </>
        ) : (
          <>
            <label className={styles.goalLabel} htmlFor="goal-path">
              Path, * for any
            </label>
            <input id="goal-path" className={styles.goalInput} name="match" placeholder="/news/*" required maxLength={200} />
          </>
        )}
      </div>
      <button className={styles.goalSubmit} type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add goal"}
      </button>
      {state.error ? (
        <p className={styles.formError} role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function DeleteGoalButton({ id, label }: { id: number; label: string }): ReactElement {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <button
      type="button"
      className={styles.removeGoal}
      disabled={pending}
      title={error ?? undefined}
      aria-label={`Remove the ${label} goal`}
      onClick={() => {
        if (!window.confirm(`Remove the “${label}” goal? Its history stays; only the goal goes.`)) return;
        start(async () => {
          const result = await deleteGoalAction(id);
          setError(result.error ?? null);
        });
      }}
    >
      {error ? "Retry" : "Remove"}
    </button>
  );
}
