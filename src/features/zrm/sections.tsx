"use client";

import {
  Fragment,
  useActionState,
  useId,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import ui from "@/features/data-room/ui.module.css";
import { addChildAction, addCompanyTypeAction, deleteChildAction, saveChildFieldAction, toggleCompanyTypeAction } from "./actions";
import { Badge, Icon } from "./bits";
import { applies, CHILDREN, type ChildKind, type FieldSpec, type SectionSpec } from "./fields";
import { FieldInput } from "./fieldUi";
import { InlineField, RecordField } from "./InlineField";
import { recordHref, type ActionState, type RecordKind, type Related, type ZrmType } from "./types";
import { useZrmData, useZrmNavigate, ZrmLink } from "./ZrmProvider";
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

/** Fields listed as labels and values, each value edited in place by `field`. */
function InlineFields({
  fields,
  render,
}: {
  fields: readonly FieldSpec[];
  render: (field: FieldSpec, labelId: string) => ReactNode;
}): ReactElement {
  const prefix = useId();
  return (
    <dl className={styles.fields}>
      {fields.map((field) => {
        const labelId = `${prefix}-${field.key}`;
        return (
          <Fragment key={field.key}>
            <dt id={labelId}>
              {field.label}
              {field.required ? " *" : ""}
            </dt>
            <dd>{render(field, labelId)}</dd>
          </Fragment>
        );
      })}
    </dl>
  );
}

/**
 * A group of a record's fields, every one that applies listed, filled or not,
 * and each edited in place. Conditions are read off the record's list row
 * where it has the column, which shows a save as it's made, so a site's terms
 * switch the moment its deal type is picked.
 */
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
}): ReactElement | null {
  const { data } = useZrmData();
  const row = (data[kind] as readonly { id: string }[]).find((r) => r.id === id);
  const fields = section.fields.filter((field) =>
    applies(field, row && field.onlyWhen && field.onlyWhen.key in row ? row : record),
  );
  if (fields.length === 0) return null;
  return (
    <Section title={section.title}>
      <InlineFields
        fields={fields}
        render={(field, labelId) => <RecordField kind={kind} id={id} field={field} record={record} labelId={labelId} />}
      />
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

/**
 * A row under a record, read as its summary; a click on the summary opens its
 * fields under it, each edited in place, and another click or Escape closes them.
 */
function ChildItem<T extends { id: string }>({
  child,
  item,
  noun,
  render,
}: {
  child: ChildKind;
  item: T;
  noun: string;
  render: (item: T) => ReactNode;
}): ReactElement {
  const fieldsId = useId();
  const [open, setOpen] = useState(false);
  const summaryRef = useRef<HTMLButtonElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    event.preventDefault();
    setOpen(false);
    summaryRef.current?.focus();
  };

  return (
    <li className={styles.item} data-open={open || undefined}>
      <div className={styles.itemBody}>
        <button
          ref={summaryRef}
          type="button"
          className={styles.itemSummary}
          aria-expanded={open}
          aria-controls={fieldsId}
          title={open ? `Close this ${noun}` : `Edit this ${noun}`}
          onClick={() => setOpen(!open)}
        >
          {render(item)}
        </button>
        {open ? (
          <div id={fieldsId} className={styles.itemFields} onKeyDown={onKeyDown}>
            <InlineFields
              fields={CHILDREN[child].fields}
              render={(field, labelId) => (
                <InlineField
                  field={field}
                  record={item}
                  labelId={labelId}
                  save={(value) => saveChildFieldAction(child, item.id, field.key, value)}
                />
              )}
            />
          </div>
        ) : null}
      </div>
      <RemoveButton child={child} id={item.id} label={`Remove ${noun}`} />
    </li>
  );
}

/** Rows under a record, e.g. its experience or notes, each edited in place, with a form to add one and a button to remove each. */
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
          <ChildItem key={item.id} child={child} item={item} noun={noun} render={render} />
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

/**
 * A company's types, chosen from the shared list: a click on them (or on Add)
 * opens every type as a checkbox that saves as it's ticked, with room to name
 * a new one. The company's row in the list shows each change at once.
 */
export function TypesSection({
  companyId,
  current,
  all,
}: {
  companyId: string;
  current: readonly ZrmType[];
  all: readonly ZrmType[];
}): ReactElement {
  const pickerId = useId();
  const { editRow } = useZrmNavigate();
  const [open, setOpen] = useState(false);
  const [ids, setIds] = useOptimistic(current.map((type) => type.id));
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, startAdding] = useTransition();
  const [, startTransition] = useTransition();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const checked = new Set(ids);
  const shown = all.filter((type) => checked.has(type.id));

  const toggle = (typeId: string, on: boolean) =>
    startTransition(async () => {
      const next = on ? [...ids, typeId] : ids.filter((id) => id !== typeId);
      setIds(next);
      editRow({ kind: "companies", id: companyId, patch: { type_ids: next } });
      const result = await toggleCompanyTypeAction(companyId, typeId, on);
      setError(result.error ?? null);
    });

  const add = () => {
    const typeName = name.trim();
    if (!typeName) return;
    startAdding(async () => {
      const result = await addCompanyTypeAction(companyId, typeName);
      setError(result.error ?? null);
      if (result.saved) setName("");
    });
  };

  const close = () => {
    setOpen(false);
    toggleRef.current?.focus();
  };

  return (
    <Section
      title="Type"
      action={
        <button
          ref={toggleRef}
          type="button"
          className={ui.linkButton}
          aria-expanded={open}
          aria-controls={pickerId}
          onClick={() => setOpen(!open)}
        >
          {open ? "Done" : "Add"}
        </button>
      }
    >
      {shown.length > 0 ? (
        <button type="button" className={styles.typesValue} aria-label="Edit types" onClick={() => setOpen(true)}>
          <TypeList types={shown} />
        </button>
      ) : open ? null : (
        <p className={styles.none}>None yet.</p>
      )}
      {open ? (
        <div
          id={pickerId}
          className={styles.typesPicker}
          onKeyDown={(event) => {
            if (event.key !== "Escape" || event.defaultPrevented) return;
            event.preventDefault();
            close();
          }}
        >
          <div className={styles.checks}>
            {all.map((type) => (
              <label key={type.id} className={styles.check}>
                <input type="checkbox" checked={checked.has(type.id)} onChange={(event) => toggle(type.id, event.target.checked)} />
                {type.name}
              </label>
            ))}
          </div>
          <div className={ui.field}>
            <label className={ui.label} htmlFor={`${pickerId}-new`}>
              New type
            </label>
            <input
              id={`${pickerId}-new`}
              className={ui.input}
              maxLength={60}
              value={name}
              disabled={adding}
              placeholder="Name it and press Enter"
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                add();
              }}
            />
          </div>
        </div>
      ) : null}
      {error ? (
        <p className={ui.error} role="alert">
          {error}
        </p>
      ) : null}
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
