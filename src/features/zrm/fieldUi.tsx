"use client";

import type { ReactElement, ReactNode } from "react";
import { Select } from "@/components/ui/Select";
import ui from "@/features/data-room/ui.module.css";
import { Badge } from "./bits";
import type { FieldSpec } from "./fields";
import { formatDecimal, formatMoney, recordHref, type Option } from "./types";
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

const read = (record: object, key: string): unknown => (record as Record<string, unknown>)[key];

/** How a field reads in the detail pane, or null when it's empty. */
export function fieldValue(field: FieldSpec, record: object): ReactNode {
  const value = read(record, field.key);
  if (value === null || value === undefined || value === "") return null;

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
      return (
        <a href={String(value)} target="_blank" rel="noreferrer noopener">
          {prettyUrl(String(value))}
        </a>
      );
    case "email":
      return <a href={`mailto:${String(value)}`}>{String(value)}</a>;
    case "tel":
      return <a href={`tel:${String(value).replace(/[^\d+]/g, "")}`}>{String(value)}</a>;
    case "money":
      return formatMoney(Number(value));
    case "decimal":
      return formatDecimal(Number(value));
    case "date":
      return formatDate(String(value));
    case "textarea":
      return <span className={styles.long}>{String(value)}</span>;
    case "company":
    case "person": {
      const name = field.display ? read(record, field.display) : null;
      return (
        <ZrmLink href={recordHref(field.type === "company" ? "companies" : "people", String(value))}>
          {String(name ?? "Open")}
        </ZrmLink>
      );
    }
    case "stage":
    case "group":
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

function inputDefault(field: FieldSpec, value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
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
  const options = useRefOptions();
  const id = `${idPrefix}-${field.key}`;
  const value = record ? read(record, field.key) : undefined;
  const defaultValue = inputDefault(field, value);
  const label = (
    <label id={`${id}-label`} htmlFor={id} className={ui.label}>
      {field.label}
      {field.required ? " *" : ""}
    </label>
  );

  if (
    field.type === "company" ||
    field.type === "person" ||
    field.type === "stage" ||
    field.type === "group" ||
    field.type === "status" ||
    field.type === "choice"
  ) {
    const named = (items: readonly { id: string; name: string }[]): Option[] =>
      items.map((item) => ({ value: item.id, label: item.name }));
    const choices: Option[] = {
      company: () => options.companies,
      person: () => options.people,
      stage: () => named(options.stages),
      group: () => named(options.groups),
      status: () => named(options.statuses),
      choice: () => (field.options ?? []).map((value) => ({ value, label: value })),
    }[field.type]();
    const withNone = field.required ? choices : [{ value: "", label: "None" }, ...choices];
    return (
      <div className={ui.field}>
        {label}
        <Select
          id={id}
          aria-labelledby={`${id}-label`}
          name={field.key}
          size="sm"
          className={ui.fill}
          options={withNone}
          defaultValue={defaultValue || withNone[0]?.value || ""}
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

  const attrs = {
    text: { type: "text" },
    email: { type: "email", autoComplete: "off" },
    url: { type: "text", inputMode: "url" as const, placeholder: "https://" },
    tel: { type: "tel" },
    int: { type: "text", inputMode: "numeric" as const },
    decimal: { type: "text", inputMode: "decimal" as const, placeholder: "0" },
    money: { type: "text", inputMode: "decimal" as const, placeholder: "0" },
    date: { type: "date" },
    list: { type: "text", placeholder: "Separate with commas" },
  }[field.type];

  return (
    <div className={ui.field} data-wide={field.type === "list" ? "" : undefined}>
      {label}
      <input id={id} name={field.key} className={ui.input} defaultValue={defaultValue} required={field.required} {...attrs} />
    </div>
  );
}
