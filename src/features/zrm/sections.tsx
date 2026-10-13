"use client";

import { Fragment, useActionState, useId, useState, useTransition, type ReactElement, type ReactNode } from "react";
import ui from "@/features/data-room/ui.module.css";
import { addChildAction, deleteChildAction, saveFieldsAction, setCompanyTypesAction } from "./actions";
import { Badge, Icon } from "./bits";
import { CHILDREN, type ChildKind, type SectionSpec } from "./fields";
import { FieldInput, fieldValue } from "./fieldUi";
import { recordHref, type ActionState, type RecordKind, type Related, type ZrmType } from "./types";
import { ZrmLink } from "./ZrmProvider";
import styles from "./zrm.module.css";

const INITIAL: ActionState = {};

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }): ReactElement {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h3>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function EditButton({ label, onClick }: { label: string; onClick: () => void }): ReactElement {
  return (
    <button type="button" className={ui.linkButton} onClick={onClick} aria-label={label}>
      Edit
    </button>
  );
}

function FormError({ state }: { state: ActionState }): ReactElement | null {
  return state.error ? (
    <p className={ui.error} role="alert">
      {state.error}
    </p>
  ) : null;
}

function FormActions({ pending, onCancel, label = "Save" }: { pending: boolean; onCancel: () => void; label?: string }) {
  return (
    <div className={styles.formActions}>
      <button type="button" className={ui.button} onClick={onCancel}>
        Cancel
      </button>
      <button type="submit" className={ui.primary} disabled={pending}>
        {pending ? "Saving…" : label}
      </button>
    </div>
  );
}

/** A group of a record's fields, read as a list and edited in place. */
export function FieldSection({
  kind,
  id,
  section,
  record,
}: {
  kind: RecordKind;
  id: string;
  section: SectionSpec;
  record: object;
}): ReactElement {
  const formId = useId();
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await saveFieldsAction(kind, id, section.id, prev, formData);
    if (result.saved) setEditing(false);
    return result;
  }, INITIAL);

  if (editing) {
    return (
      <Section title={section.title}>
        <form action={action} className={styles.form}>
          <div className={styles.formGrid}>
            {section.fields
              .filter((field) => !field.readOnly)
              .map((field) => (
                <FieldInput key={field.key} field={field} record={record} idPrefix={formId} />
              ))}
          </div>
          <FormError state={state} />
          <FormActions pending={pending} onCancel={() => setEditing(false)} />
        </form>
      </Section>
    );
  }

  const filled = section.fields
    .map((field) => ({ field, value: fieldValue(field, record) }))
    .filter((entry) => entry.value !== null);

  return (
    <Section title={section.title} action={<EditButton label={`Edit ${section.title.toLowerCase()}`} onClick={() => setEditing(true)} />}>
      {filled.length > 0 ? (
        <dl className={styles.fields}>
          {filled.map(({ field, value }) => (
            <Fragment key={field.key}>
              <dt>{field.label}</dt>
              <dd>{value}</dd>
            </Fragment>
          ))}
        </dl>
      ) : (
        <p className={styles.none}>Nothing yet.</p>
      )}
    </Section>
  );
}

function RemoveButton({ child, id, label }: { child: ChildKind; id: string; label: string }): ReactElement {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className={`${ui.iconButton} ${styles.itemRemove}`}
      aria-label={label}
      title={label}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await deleteChildAction(child, id);
        })
      }
    >
      <Icon name="close" />
    </button>
  );
}

/** Rows under a record, e.g. its experience or notes, with a form to add one and a button to remove each. */
export function ChildSection<T extends { id: string }>({
  title,
  child,
  kind,
  parentId,
  items,
  render,
  addLabel,
  formFirst = false,
  noun,
}: {
  title?: string;
  child: ChildKind;
  kind: RecordKind;
  parentId: string;
  items: readonly T[];
  render: (item: T) => ReactNode;
  addLabel: string;
  /** Opens the form above the rows, as for notes. */
  formFirst?: boolean;
  noun: string;
}): ReactElement {
  const formId = useId();
  const [adding, setAdding] = useState(formFirst);
  const [formKey, setFormKey] = useState(0);
  const [state, action, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await addChildAction(child, kind, parentId, prev, formData);
    if (result.saved) {
      setFormKey((key) => key + 1);
      if (!formFirst) setAdding(false);
    }
    return result;
  }, INITIAL);

  const form = adding ? (
    <form key={formKey} action={action} className={styles.form}>
      <div className={styles.formGrid}>
        {CHILDREN[child].fields.map((field) => (
          <FieldInput key={field.key} field={field} record={null} idPrefix={formId} />
        ))}
      </div>
      <FormError state={state} />
      {formFirst ? (
        <div className={styles.formActions}>
          <button type="submit" className={ui.primary} disabled={pending}>
            {pending ? "Saving…" : addLabel}
          </button>
        </div>
      ) : (
        <FormActions pending={pending} onCancel={() => setAdding(false)} label={addLabel} />
      )}
    </form>
  ) : null;

  const list =
    items.length > 0 ? (
      <ul className={styles.items}>
        {items.map((item) => (
          <li key={item.id} className={styles.item}>
            <div className={styles.itemBody}>{render(item)}</div>
            <RemoveButton child={child} id={item.id} label={`Remove ${noun}`} />
          </li>
        ))}
      </ul>
    ) : adding ? null : (
      <p className={styles.none}>None yet.</p>
    );

  const body = (
    <>
      {formFirst ? form : null}
      {list}
      {formFirst ? null : form}
    </>
  );

  if (!title) return body;
  return (
    <Section
      title={title}
      action={
        adding ? null : (
          <button type="button" className={ui.linkButton} onClick={() => setAdding(true)}>
            Add
          </button>
        )
      }
    >
      {body}
    </Section>
  );
}

/** A company's types, chosen from the shared list, with room to add a new one. */
export function TypesSection({
  companyId,
  current,
  all,
}: {
  companyId: string;
  current: readonly ZrmType[];
  all: readonly ZrmType[];
}): ReactElement {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await setCompanyTypesAction(companyId, prev, formData);
    if (result.saved) setEditing(false);
    return result;
  }, INITIAL);
  const checked = new Set(current.map((type) => type.id));

  if (editing) {
    return (
      <Section title="Type">
        <form action={action} className={styles.form}>
          <div className={styles.checks}>
            {all.map((type) => (
              <label key={type.id} className={styles.check}>
                <input type="checkbox" name="type" value={type.id} defaultChecked={checked.has(type.id)} />
                {type.name}
              </label>
            ))}
          </div>
          <div className={ui.field}>
            <label className={ui.label} htmlFor={`new-type-${companyId}`}>
              New type
            </label>
            <input id={`new-type-${companyId}`} name="new_type" className={ui.input} maxLength={60} />
          </div>
          <FormError state={state} />
          <FormActions pending={pending} onCancel={() => setEditing(false)} />
        </form>
      </Section>
    );
  }

  return (
    <Section title="Type" action={<EditButton label="Edit types" onClick={() => setEditing(true)} />}>
      <TypeList types={current} />
    </Section>
  );
}

export function TypeList({ types }: { types: readonly ZrmType[] }): ReactElement {
  return types.length > 0 ? (
    <span className={styles.badges}>
      {types.map((type) => (
        <Badge key={type.id} color={type.color}>
          {type.name}
        </Badge>
      ))}
    </span>
  ) : (
    <p className={styles.none}>None yet.</p>
  );
}

/** Records linked to this one, e.g. a company's people, with a link to add another. */
export function RelatedSection({
  title,
  kind,
  items,
  addHref,
}: {
  title: string;
  kind: RecordKind;
  items: readonly Related[];
  addHref?: string;
}): ReactElement {
  return (
    <Section
      title={`${title} (${items.length})`}
      action={
        addHref ? (
          <ZrmLink href={addHref} className={ui.linkButton}>
            Add
          </ZrmLink>
        ) : null
      }
    >
      {items.length > 0 ? (
        <ul className={styles.items}>
          {items.map((item) => (
            <li key={item.id} className={styles.item}>
              <div className={styles.itemBody}>
                <ZrmLink href={recordHref(kind, item.id)} className={styles.relatedName}>
                  {item.label}
                </ZrmLink>
                {item.detail ? <span className={styles.itemMeta}>{item.detail}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.none}>None yet.</p>
      )}
    </Section>
  );
}

export { Section };
