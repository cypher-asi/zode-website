"use client";

import { useId, useState, type CSSProperties, type KeyboardEvent, type ReactElement } from "react";
import { formatValue, fromEditable, toEditable } from "./format";
import type { Format } from "./model/inputs";
import styles from "./Slider.module.css";

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const share = (n: number, min: number, max: number) => (max > min ? (clamp(n, min, max) - min) / (max - min) : 0);

/**
 * A labelled range with its value beside the label. The value is also a
 * button that swaps in a text field for typing an exact figure, clamped to
 * the range. A tick under the track marks the model's default.
 */
export function Slider({
  label,
  note,
  value,
  min,
  max,
  step,
  format,
  defaultValue,
  onChange,
}: {
  label: string;
  note?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: Format;
  defaultValue?: number;
  onChange: (value: number) => void;
}): ReactElement {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const changed = defaultValue !== undefined && Math.abs(value - defaultValue) > 1e-9;

  const commit = () => {
    if (draft === null) return;
    const n = fromEditable(format, draft);
    if (n !== null) onChange(clamp(n, min, max));
    setDraft(null);
  };

  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") commit();
    if (event.key === "Escape") setDraft(null);
  };

  return (
    <div
      className={styles.slider}
      style={
        {
          "--fill": share(value, min, max),
          "--default": defaultValue === undefined ? 0 : share(defaultValue, min, max),
        } as CSSProperties
      }
    >
      <div className={styles.head}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        {draft === null ? (
          <button
            type="button"
            className={styles.value}
            data-changed={changed || undefined}
            aria-label={`Type a value for ${label}`}
            onClick={() => setDraft(toEditable(format, value))}
          >
            {formatValue(format, value)}
          </button>
        ) : (
          <input
            className={styles.edit}
            inputMode="decimal"
            aria-label={label}
            value={draft}
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={onKey}
          />
        )}
      </div>
      <div className={styles.track}>
        <input
          id={id}
          className={styles.range}
          type="range"
          min={min}
          max={max}
          step={step}
          value={clamp(value, min, max)}
          aria-valuetext={formatValue(format, value)}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {defaultValue !== undefined ? (
          <button
            type="button"
            className={styles.tick}
            aria-label={`Reset ${label} to ${formatValue(format, defaultValue)}`}
            title={`Default ${formatValue(format, defaultValue)}`}
            onClick={() => onChange(defaultValue)}
            tabIndex={changed ? 0 : -1}
          />
        ) : null}
      </div>
      {note ? <p className={styles.note}>{note}</p> : null}
    </div>
  );
}

/** An on / off switch for the model's 1 / 0 flags. */
export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}): ReactElement {
  return (
    <label className={styles.toggle}>
      <span className={styles.label}>{label}</span>
      <input
        className={styles.switch}
        type="checkbox"
        role="switch"
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
