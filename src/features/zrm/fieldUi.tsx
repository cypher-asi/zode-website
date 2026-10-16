"use client";

import type { ReactElement, ReactNode } from "react";
import { Select } from "@/components/ui/Select";
import ui from "@/features/data-room/ui.module.css";
import { Badge } from "./bits";
import type { FieldSpec, FieldType } from "./fields";
import { formatDecimal, formatMoney, recordHref, roomHref, type Option } from "./types";
import { useRefOptions, ZrmLink } from "./ZrmProvider";
import styles from "./zrm.module.css";

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const monthFormat = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

/** A `YYYY-MM-DD` date, e.g. "Sep 1, 2019", or "Sep 2019" with `month`. */
export function formatDate(value: string | Date | null, month = false): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(`${value}T00:00:00Z`) : value;
  return Number.isNaN(date.getTime()) ? String(value) : (month ? monthFormat : dateFormat).format(date);
}

/** A span of dates, e.g. "Sep 2019 – Present". */
export function formatSpan(start: string | null, end: string | null): string {
  if (!start && !end) return "";
  return `${formatDate(start, true) || "?"} – ${end ? formatDate(end, true) : "Present"}`;
}

const prettyUrl = (href: string): string => href.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");

export const read = (record: object, key: string): unknown => (record as Record<string, unknown>)[key];

/** A date column as `YYYY-MM-DD`, whether it arrives as one or, from a timestamp column, as a Date. */
const dateString = (value: unknown): string =>
  value instanceof Date ? (Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10)) : String(value);

/** Fields chosen from a list rather than typed. */
export const PICKED: ReadonlySet<FieldType> = new Set(["company", "person", "stage", "status", "room", "choice"]);

/** Where a field's value points, e.g. a link, a mail address or a linked record, or null when it's empty or points nowhere. */
export function fieldHref(field: FieldSpec, record: object): string | null {
  const value = read(record, field.key);
  if (value === null || value === undefined || value === "") return null;
  switch (field.type) {
    case "url":
      return String(value);
    case "email":
      return `mailto:${String(value)}`;
    case "tel":
      return `tel:${String(value).replace(/[^\d+]/g, "")}`;
    case "company":
      return recordHref("companies", String(value));
    case "person":
      return recordHref("people", String(value));
    case "room":
      return roomHref(String(value));
    default:
      return null;
  }
}

/**
 * How a field reads in the detail pane, or null when it's empty. Links and
 * linked records are links, or with `linked` false plain text, e.g. inside a
 * button that edits them.
 */
export function fieldValue(field: FieldSpec, record: object, linked = true): ReactNode {
  const value = read(record, field.key);
  if (value === null || value === undefined || value === "") return null;
  const href = linked ? fieldHref(field, record) : null;
  const named = () => String((field.display ? read(record, field.display) : null) ?? (linked ? "Open" : value));

  switch (field.type) {
    case "list":
      return Array.isArray(value) && value.length > 0 ? (
        <span className={styles.badges}>
          {value.map((item: string) => (
            <Badge key={item}>{item}</Badge>
          ))}
        </span>
      ) : null;
    case "url":
      return href ? (
        <a href={href} target="_blank" rel="noreferrer noopener">
          {prettyUrl(String(value))}
        </a>
      ) : (
        prettyUrl(String(value))
      );
    case "email":
    case "tel":
      return href ? <a href={href}>{String(value)}</a> : String(value);
    case "money":
      return formatMoney(Number(value));
    case "decimal":
      return formatDecimal(Number(value));
    case "date":
      return formatDate(dateString(value));
    case "textarea":
      return <span className={styles.long}>{String(value)}</span>;
    case "company":
    case "person":
    case "room":
      return href ? <ZrmLink href={href}>{named()}</ZrmLink> : named();
    case "stage":
      return <Badge>{String(field.display ? read(record, field.display) : value)}</Badge>;
    case "status": {
      const color = read(record, "status_color");
      return (
        <Badge color={typeof color === "string" ? color : undefined}>
          {String(field.display ? read(record, field.display) : value)}
        </Badge>
      );
    }
    default:
      return String(value);
  }
}

/** A field's value as its input holds it. */
export function inputDefault(field: FieldSpec, value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (field.type === "date") return dateString(value);
  return String(value);
}

/** The input attributes of each typed field. */
export const INPUT_ATTRS = {
  text: { type: "text" },
  email: { type: "email", autoComplete: "off" },
  url: { type: "text", inputMode: "url" as const, placeholder: "https://" },
  tel: { type: "tel" },
  int: { type: "text", inputMode: "numeric" as const },
  decimal: { type: "text", inputMode: "decimal" as const, placeholder: "0" },
  money: { type: "text", inputMode: "decimal" as const, placeholder: "0" },
  date: { type: "date" },
  list: { type: "text", placeholder: "Separate with commas" },
} satisfies Partial<Record<FieldType, object>>;

export type TypedField = keyof typeof INPUT_ATTRS;

/** A picked field's choices, led by a "None" that clears it unless it's required. */
export function useFieldChoices(field: FieldSpec): Option[] {
  const options = useRefOptions();
  if (!PICKED.has(field.type)) return [];
  const named = (items: readonly { id: string; name: string }[]): Option[] => items.map((item) => ({ value: item.id, label: item.name }));
  const choices: Option[] =
    field.type === "company"
      ? options.companies
      : field.type === "person"
        ? options.people
        : field.type === "stage"
          ? named(options.stages)
          : field.type === "status"
            ? named(options.statuses)
            : field.type === "room"
              ? named(options.rooms)
              : (field.options ?? []).map((value) => ({ value, label: value }));
  return field.required ? choices : [{ value: "", label: "None" }, ...choices];
}

/** One labelled input for a field, named after it so the form posts it under its column. */
export function FieldInput({
  field,
  record,
  idPrefix,
}: {
  field: FieldSpec;
  record: object | null;
  idPrefix: string;
}): ReactElement {
  const choices = useFieldChoices(field);
  const id = `${idPrefix}-${field.key}`;
  const value = record ? read(record, field.key) : undefined;
  const defaultValue = inputDefault(field, value);
  const label = (
    <label id={`${id}-label`} htmlFor={id} className={ui.label}>
      {field.label}
      {field.required ? " *" : ""}
    </label>
  );

  if (PICKED.has(field.type)) {
    return (
      <div className={ui.field}>
        {label}
        <Select
          id={id}
          aria-labelledby={`${id}-label`}
          name={field.key}
          size="sm"
          className={ui.fill}
          options={choices}
          defaultValue={defaultValue || choices[0]?.value || ""}
        />
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div className={ui.field} data-wide="">
        {label}
        <textarea id={id} name={field.key} className={ui.textarea} defaultValue={defaultValue} required={field.required} rows={4} />
      </div>
    );
  }

  return (
    <div className={ui.field} data-wide={field.type === "list" ? "" : undefined}>
      {label}
      <input
        id={id}
        name={field.key}
        className={ui.input}
        defaultValue={defaultValue}
        required={field.required}
        {...INPUT_ATTRS[field.type as TypedField]}
      />
    </div>
  );
}
