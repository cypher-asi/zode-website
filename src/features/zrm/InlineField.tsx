"use client";

import {
  useEffect,
  useId,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import { Select } from "@/components/ui/Select";
import ui from "@/features/data-room/ui.module.css";
import { multiLine, singleLine } from "@/lib/validation";
import { saveFieldAction } from "./actions";
import { Icon } from "./bits";
import type { FieldSpec } from "./fields";
import {
  fieldHref,
  fieldValue,
  INPUT_ATTRS,
  inputDefault,
  isSearched,
  PICKED,
  read,
  RefCombobox,
  Suggestions,
  useFieldChoices,
  type TypedField,
} from "./fieldUi";
import { personName, type ActionState, type RecordKind, type ZrmData } from "./types";
import { useZrmData, useZrmNavigate, ZrmLink } from "./ZrmProvider";
import styles from "./zrm.module.css";

const numberFrom = (value: string): number => Number(value.replace(/[$,\s]/g, ""));

/**
 * The columns a save of `field` changes, cleaned as `saveFieldAction` cleans
 * them, with a reference's name (and a status's colour) looked up alongside,
 * or for a company or person not in the lists yet, `label`.
 */
function savedColumns(field: FieldSpec, input: string, data: ZrmData, label?: string): Record<string, unknown> {
  if (field.type === "list") return { [field.key]: [...new Set(input.split(/[,\n]/).map(singleLine).filter(Boolean))] };
  const value = field.type === "textarea" ? multiLine(input) : singleLine(input);
  const columns: Record<string, unknown> = {};
  if (!value) {
    columns[field.key] = null;
    if (field.display) columns[field.display] = null;
    return columns;
  }
  switch (field.type) {
    case "url":
      columns[field.key] = /^https?:\/\//i.test(value) ? value : `https://${value}`;
      break;
    case "int":
    case "decimal":
    case "money":
      columns[field.key] = numberFrom(value);
      break;
    default:
      columns[field.key] = value;
  }
  if (!field.display) return columns;
  const named = (items: readonly { id: string; name: string }[]) => items.find((item) => item.id === value)?.name ?? null;
  switch (field.type) {
    case "company":
      columns[field.display] = named(data.companies) ?? label ?? null;
      break;
    case "person": {
      const person = data.people.find((p) => p.id === value);
      columns[field.display] = person ? personName(person) : (label ?? null);
      break;
    }
    case "stage":
      columns[field.display] = named(data.stages);
      break;
    case "room":
      columns[field.display] = named(data.rooms);
      break;
    case "status": {
      const status = data.statuses.find((s) => s.id === value);
      columns[field.display] = status?.name ?? null;
      if (status) columns.status_color = status.color;
      break;
    }
  }
  return columns;
}

/** A small link beside a value that points somewhere, so a click on the value itself can always edit it. */
function OpenLink({ field, href }: { field: FieldSpec; href: string }): ReactElement {
  const label = field.type === "url" ? `Open ${field.label}` : field.type === "email" ? "Send email" : field.type === "tel" ? "Call" : "Open";
  const icon = <Icon name="external" />;
  if (field.type === "company" || field.type === "person" || field.type === "room") {
    return (
      <ZrmLink href={href} className={styles.inlineOpen} aria-label={label} title={label}>
        {icon}
      </ZrmLink>
    );
  }
  return (
    <a
      href={href}
      className={styles.inlineOpen}
      aria-label={label}
      title={label}
      {...(field.type === "url" ? { target: "_blank", rel: "noreferrer noopener" } : {})}
    >
      {icon}
    </a>
  );
}

/**
 * One field edited where it's shown: a click (or Enter) on its value opens
 * an input in its place that saves on Enter, blur or Tab and cancels on
 * Escape; a picked field is a select that saves as soon as it's chosen. The
 * saved value shows at once, and if `save` fails the input reopens with what
 * was typed and the error under it.
 */
export function InlineField({
  field,
  record,
  labelId,
  save,
  onSaving,
}: {
  field: FieldSpec;
  record: object;
  /** Id of the field's visible label. */
  labelId: string;
  save: (value: string) => Promise<ActionState>;
  /** Called in the save's transition with the columns it changes, e.g. to show them in the lists too. */
  onSaving?: (columns: Record<string, unknown>) => void;
}): ReactElement {
  const id = useId();
  const { data } = useZrmData();
  const choices = useFieldChoices(field);
  const [shown, setShown] = useOptimistic(record);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const valueRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  /** Set once the open input has saved or cancelled, so its blur as it closes doesn't save again. */
  const settled = useRef(false);
  /** Set when the input closes from the keyboard, to hand focus back to the value. */
  const refocus = useRef(false);

  const current = inputDefault(field, read(shown, field.key));

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (refocus.current) {
      refocus.current = false;
      valueRef.current?.focus();
    }
  }, [editing]);

  const open = () => {
    settled.current = false;
    setDraft(current);
    setEditing(true);
  };

  const commit = (value: string, label?: string) => {
    settled.current = true;
    setEditing(false);
    if (value === current) {
      setError(null);
      return;
    }
    startTransition(async () => {
      const columns = savedColumns(field, value, data, label);
      setShown({ ...shown, ...columns });
      onSaving?.(columns);
      const result = await save(value);
      if (result.error) {
        setError(result.error);
        setDraft(value);
        settled.current = false;
        setEditing(true);
      } else {
        setError(null);
      }
    });
  };

  const cancel = () => {
    settled.current = true;
    refocus.current = true;
    setError(null);
    setEditing(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancel();
    } else if (event.key === "Enter" && (field.type !== "textarea" || event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      refocus.current = true;
      commit(draft);
    }
  };

  const href = fieldHref(field, shown);
  const errorId = `${id}-error`;
  const errorLine = error ? (
    <p id={errorId} className={`${ui.error} ${styles.inlineError}`} role="alert">
      {error}
    </p>
  ) : null;

  if (field.readOnly) {
    return <span className={styles.inlineStatic}>{fieldValue(field, shown) ?? <span className={styles.inlineEmpty}>Empty</span>}</span>;
  }

  if (isSearched(field) && editing) {
    return (
      <>
        <RefCombobox
          field={field}
          value={current}
          autoFocus
          inputClassName={styles.inlineInput}
          aria-labelledby={labelId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(value, option) => {
            refocus.current = true;
            commit(value, option.label);
          }}
          onCancel={cancel}
          onBlur={() => {
            if (settled.current) return;
            settled.current = true;
            setEditing(false);
          }}
        />
        {errorLine}
      </>
    );
  }

  if (PICKED.has(field.type) && !isSearched(field)) {
    return (
      <>
        <div className={styles.inline}>
          <Select
            size="sm"
            variant="ghost"
            className={current ? styles.inlineSelect : `${styles.inlineSelect} ${styles.inlineSelectEmpty}`}
            aria-labelledby={labelId}
            options={choices}
            value={current}
            placeholder="Empty"
            onChange={commit}
          />
          {href ? <OpenLink field={field} href={href} /> : null}
        </div>
        {errorLine}
      </>
    );
  }

  if (editing) {
    const shared = {
      ref: inputRef,
      className: styles.inlineInput,
      value: draft,
      "aria-labelledby": labelId,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? errorId : undefined,
      onKeyDown,
      onBlur: () => {
        if (!settled.current) commit(draft);
      },
    };
    return (
      <>
        {field.type === "textarea" ? (
          <textarea {...shared} data-multiline="" rows={2} onChange={(event) => setDraft(event.target.value)} />
        ) : (
          <>
            <input
              {...shared}
              {...INPUT_ATTRS[field.type as TypedField]}
              list={field.suggest ? `${id}-suggestions` : undefined}
              onChange={(event) => setDraft(event.target.value)}
            />
            <Suggestions id={`${id}-suggestions`} field={field} />
          </>
        )}
        {errorLine}
      </>
    );
  }

  const value = fieldValue(field, shown, false);
  return (
    <>
      <div className={styles.inline}>
        <button
          ref={valueRef}
          id={`${id}-value`}
          type="button"
          className={styles.inlineValue}
          aria-labelledby={`${labelId} ${id}-value`}
          aria-describedby={error ? errorId : undefined}
          title={`Edit ${field.label.toLowerCase()}`}
          onClick={open}
        >
          {value ?? <span className={styles.inlineEmpty}>Empty</span>}
        </button>
        {href ? <OpenLink field={field} href={href} /> : null}
      </div>
      {errorLine}
    </>
  );
}

/** A record's field edited in place, shown in the lists as it saves. */
export function RecordField({
  kind,
  id,
  field,
  record,
  labelId,
}: {
  kind: RecordKind;
  id: string;
  field: FieldSpec;
  record: object;
  labelId: string;
}): ReactElement {
  const { editRow } = useZrmNavigate();
  return (
    <InlineField
      field={field}
      record={record}
      labelId={labelId}
      save={(value) => saveFieldAction(kind, id, field.key, value)}
      onSaving={(columns) => editRow({ kind, id, patch: columns })}
    />
  );
}
