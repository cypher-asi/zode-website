"use client";

import { useActionState, useId, type ReactElement } from "react";
import ui from "@/features/data-room/ui.module.css";
import { saveFieldsAction } from "./actions";
import { Icon } from "./bits";
import { CREATE_FIELDS } from "./fields";
import { FieldInput } from "./fieldUi";
import { KIND_LABELS, listHref, type ActionState, type RecordKind } from "./types";
import { ZrmLink } from "./ZrmProvider";
import styles from "./zrm.module.css";

const INITIAL: ActionState = {};

/** The New form in the right pane; saving opens the record, where the rest of its fields are filled in. */
export function NewRecordForm({
  kind,
  defaults,
}: {
  kind: RecordKind;
  /** Prefilled references, e.g. the company a person is added from. */
  defaults: Record<string, string>;
}): ReactElement {
  const formId = useId();
  const [state, action, pending] = useActionState(saveFieldsAction.bind(null, kind, null, "create"), INITIAL);
  const singular = KIND_LABELS[kind].singular.toLowerCase();

  return (
    <>
      <header className={styles.detailHeader}>
        <ZrmLink href={listHref(kind)} className={`${ui.iconButton} ${styles.back}`} aria-label={`Back to ${KIND_LABELS[kind].plural}`}>
          <Icon name="back" />
        </ZrmLink>
        <div className={styles.detailTitle}>
          <h2>New {singular}</h2>
        </div>
      </header>
      <form action={action} className={`${styles.form} ${styles.newForm}`}>
        <div className={styles.formGrid}>
          {CREATE_FIELDS[kind].map((field) => (
            <FieldInput key={field.key} field={field} record={defaults} idPrefix={formId} />
          ))}
        </div>
        {state.error ? (
          <p className={ui.error} role="alert">
            {state.error}
          </p>
        ) : null}
        <div className={styles.formActions}>
          <ZrmLink href={listHref(kind)} className={ui.button}>
            Cancel
          </ZrmLink>
          <button type="submit" className={ui.primary} disabled={pending}>
            {pending ? "Creating…" : `Create ${singular}`}
          </button>
        </div>
      </form>
    </>
  );
}
