"use client";

import { useActionState, type ReactElement } from "react";
import { signMndaAction, type MndaState } from "./actions";
import { MndaForm } from "./MndaForm";
import styles from "./Mnda.module.css";

/** The public signing form, replaced by a confirmation once the agreement is executed. */
export function MndaSigner({ templateVersion }: { templateVersion: string }): ReactElement {
  const [state, sign, pending] = useActionState<MndaState, FormData>(signMndaAction, { status: "idle" });

  if (state.status === "signed") {
    return (
      <div className={styles.done} role="status">
        <svg className={styles.tick} viewBox="0 0 52 52" aria-hidden="true">
          <circle cx="26" cy="26" r="24" />
          <path d="M16 27l7 7 13-15" />
        </svg>
        <h2 className={styles.doneTitle}>The MNDA is signed.</h2>
        <p className={styles.doneText}>
          ZODE Inc. has countersigned the agreement with <strong>{state.entityName}</strong>
          {state.entityName.endsWith(".") ? "" : "."} The executed PDF is on its way to <strong>{state.email}</strong>{" "}
          and to the ZODE team.
        </p>
      </div>
    );
  }

  return (
    <MndaForm
      action={sign}
      pending={pending}
      error={state.status === "error" ? state.error : null}
      templateVersion={templateVersion}
      submitLabel="Sign the MNDA"
    />
  );
}
