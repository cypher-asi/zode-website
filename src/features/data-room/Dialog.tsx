"use client";

import { useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from "react";
import { Select } from "@/components/ui/Select";
import styles from "./ui.module.css";

export interface DialogProps {
  title: string;
  description?: ReactNode;
  /** Shows a text field when set; its value is passed to `onConfirm`. */
  input?: { label: string; initial: string };
  /** Shows a select when set; its value is passed to `onConfirm`. */
  choice?: { label: string; options: { value: string; label: string }[]; initial: string };
  confirmLabel: string;
  danger?: boolean;
  /** Resolve with an error message to keep the dialog open, or nothing to close it. */
  onConfirm: (value: string) => Promise<string | void> | string | void;
  onClose: () => void;
}

/** A modal prompt on the native <dialog>, which brings focus trapping and Escape to close. */
export function Dialog({
  title,
  description,
  input,
  choice,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: DialogProps): ReactElement {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [value, setValue] = useState(input?.initial ?? choice?.initial ?? "");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) ref.current?.close();
      }}
    >
      <form
        className={styles.dialogForm}
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError(undefined);
          const result = await onConfirm(value);
          setPending(false);
          if (result) setError(result);
          else ref.current?.close();
        }}
      >
        <h2 className={styles.dialogTitle}>{title}</h2>
        {description ? <p className={styles.dialogText}>{description}</p> : null}
        {input ? (
          <label className={styles.field}>
            <span className={styles.label}>{input.label}</span>
            <input
              className={styles.input}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              autoFocus
              onFocus={(event) => {
                const dot = event.target.value.lastIndexOf(".");
                event.target.setSelectionRange(0, dot > 0 ? dot : event.target.value.length);
              }}
              maxLength={200}
              required
            />
          </label>
        ) : null}
        {choice ? (
          <div className={styles.field}>
            <label id={`${id}-label`} htmlFor={id} className={styles.label}>
              {choice.label}
            </label>
            <Select
              id={id}
              aria-labelledby={`${id}-label`}
              size="sm"
              className={styles.fill}
              options={choice.options}
              value={value}
              onChange={setValue}
            />
          </div>
        ) : null}
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.dialogActions}>
          <button type="button" className={styles.button} onClick={() => ref.current?.close()}>
            Cancel
          </button>
          <button type="submit" className={danger ? styles.danger : styles.primary} disabled={pending}>
            {pending ? "Working…" : confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
