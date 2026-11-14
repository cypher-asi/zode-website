"use client";

import { useState, type ReactElement, type ReactNode } from "react";
import styles from "../chassis.module.css";

const text = (value: string | number | null | undefined): string => (value == null ? "" : String(value));

/** A text or number input that commits on blur or Enter, so each edit is one undo step; Escape puts it back. */
export function EditField({
  value,
  onCommit,
  type = "text",
  placeholder,
  label,
}: {
  value: string | number | null | undefined;
  onCommit: (value: string) => void;
  type?: "text" | "number" | "url";
  placeholder?: string;
  /** For screen readers, where no visible label names the field. */
  label?: string;
}): ReactElement {
  const [draft, setDraft] = useState<{ from: string; value: string } | null>(null);
  const shown = draft && draft.from === text(value) ? draft.value : text(value);
  const commit = () => {
    if (draft && draft.value !== text(value)) onCommit(draft.value);
    setDraft(null);
  };
  return (
    <input
      className={styles.cell}
      type={type}
      value={shown}
      placeholder={placeholder}
      aria-label={label}
      onChange={(event) => setDraft({ from: text(value), value: event.target.value })}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") setDraft(null);
      }}
    />
  );
}

/** A number from what was typed, "$1,200" included; null for blank or not a number. */
export function num(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function Row({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <label className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span>{children}</span>
    </label>
  );
}

export function Panel({
  title,
  right,
  children,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
}): ReactElement {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <h3 className={styles.panelTitle}>{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}
