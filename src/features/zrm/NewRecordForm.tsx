"use client";

import { useActionState, useId, type ReactElement } from "react";
import Link from "next/link";
import ui from "@/features/data-room/ui.module.css";
import { saveFieldsAction } from "./actions";
import { Icon } from "./bits";
import { CREATE_FIELDS } from "./fields";
import { FieldInput, type RefOptions } from "./fieldUi";
import { KIND_LABELS, type ActionState, type ZrmKind } from "./types";
import styles from "./zrm.module.css";

const INITIAL: ActionState = {};

/** The New form in the right pane; saving opens the record, where the rest of its fields are filled in. */
export function NewRecordForm({
  kind,
  options,
  defaults,
}: {
  kind: ZrmKind;
  options: RefOptions;
  /** Prefilled references, e.g. the company a person is added from. */
  defaults: Record<string, string>;
}): ReactElement {
  const formId = useId();
  const [state, action, pending] = useActionState(saveFieldsAction.bind(null, kind, null, "create"), INITIAL);
  const singular = KIND_LABELS[kind].singular.toLowerCase();

  return (
    <>
      <header className={styles.detailHeader}>
        <Link href={`/portal/zrm/${kind}`} className={`${ui.iconButton} ${styles.back}`} aria-label={`Back to ${KIND_LABELS[kind].plural}`}>
          <Icon name="back" />
        </Link>
        <div className={styles.detailTitle}>
          <h2>New {singular}</h2>
        </div>
      </header>
      <form action={action} className={`${styles.form} ${styles.newForm}`}>
        <div className={styles.formGrid}>
          {CREATE_FIELDS[kind].map((field) => (
            <FieldInput key={field.key} field={field} record={defaults} options={options} idPrefix={formId} />
          ))}
        </div>
        {state.error ? (
          <p className={ui.error} role="alert">
            {state.error}
          </p>
        ) : null}
        <div className={styles.formActions}>
          <Link href={`/portal/zrm/${kind}`} className={ui.button}>
            Cancel
          </Link>
          <button type="submit" className={ui.primary} disabled={pending}>
            {pending ? "Creating…" : `Create ${singular}`}
          </button>
        </div>
      </form>
    </>
  );
}
