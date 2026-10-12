"use client";

import { useId, type CSSProperties, type ReactElement } from "react";
import {
  NODE_SIZES,
  usdShort,
  type Choice,
  type Focus,
  type RedundancyChoice,
  type RedundancyId,
} from "./buyConfig";
import styles from "./StepPanel.module.css";

export interface StepDef {
  id: string;
  title: string;
}

/** Numbered tabs across the top of the panel; any step can be opened directly. */
export function StepTabs({
  steps,
  active,
  onSelect,
}: {
  steps: readonly StepDef[];
  active: number;
  onSelect: (index: number) => void;
}): ReactElement {
  return (
    <ol className={styles.tabs} aria-label="Configuration steps">
      {steps.map((step, i) => (
        <li key={step.id}>
          <button
            type="button"
            className={styles.tab}
            data-state={i < active ? "done" : i === active ? "active" : undefined}
            aria-current={i === active ? "step" : undefined}
            onClick={() => onSelect(i)}
          >
            <span className={styles.tabNo}>{String(i + 1).padStart(2, "0")}</span>
            <span className={styles.tabTitle}>{step.title}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

/** Two or more mutually exclusive modes as one pill-shaped segmented control. */
export function Segmented<Id extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { id: Id; label: string }[];
  value: Id;
  onChange: (id: Id) => void;
}): ReactElement {
  const name = useId();
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <label key={option.id} className={styles.segment} data-checked={option.id === value || undefined}>
          <input
            className={styles.input}
            type="radio"
            name={name}
            value={option.id}
            checked={option.id === value}
            onChange={() => onChange(option.id)}
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

type Preview<F = Focus> = (focus: F | null) => void;

/** Hover and keyboard focus both preview an option's part of the drawing. */
const previewHandlers = <F,>(focus: F | undefined, onPreview: Preview<F>) => ({
  onMouseEnter: () => focus && onPreview(focus),
  onMouseLeave: () => onPreview(null),
  onFocus: () => focus && onPreview(focus),
  onBlur: () => onPreview(null),
});

/** Radio cards for one exclusive choice; `inline` sets them side by side instead of stacked. */
export function ChoiceGroup<Id extends string, F = Focus>({
  legend,
  choices,
  value,
  onChange,
  onPreview,
  inline = false,
}: {
  legend: string;
  choices: readonly Choice<Id, F>[];
  value: Id;
  onChange: (id: Id) => void;
  onPreview: Preview<F>;
  inline?: boolean;
}): ReactElement {
  const name = useId();
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.cards} data-inline={inline || undefined}>
        {choices.map((choice) => (
          <label
            key={choice.id}
            className={styles.card}
            data-checked={choice.id === value || undefined}
            data-disabled={choice.disabled || undefined}
            {...previewHandlers(choice.focus, onPreview)}
          >
            <input
              className={styles.input}
              type="radio"
              name={name}
              value={choice.id}
              checked={choice.id === value}
              disabled={choice.disabled}
              onChange={() => onChange(choice.id)}
            />
            <span className={styles.cardLabel}>
              {choice.label}
              {choice.badge ? <span className={styles.badge}>{choice.badge}</span> : null}
            </span>
            {choice.detail ? <span className={styles.cardDetail}>{choice.detail}</span> : null}
            {choice.note ? <span className={styles.cardNote}>{choice.note}</span> : null}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** A card that is always selected and cannot be changed. */
export function IncludedCard<F = Focus>({
  legend,
  choice,
  onPreview,
}: {
  legend: string;
  choice: Choice<string, F>;
  onPreview: Preview<F>;
}): ReactElement {
  return (
    <div className={styles.group}>
      <p className={styles.legend}>{legend}</p>
      <div
        className={styles.card}
        data-checked=""
        data-locked=""
        tabIndex={0}
        aria-label={`${choice.label}, included`}
        {...previewHandlers(choice.focus, onPreview)}
      >
        <span className={styles.cardLabel}>{choice.label}</span>
        <span className={styles.cardDetail}>{choice.detail}</span>
        <span className={styles.cardNote}>{choice.note}</span>
      </div>
    </div>
  );
}

/** The entry in `sizes` closest to `n`. */
const nearest = (sizes: readonly number[], n: number) =>
  sizes.reduce((best, size) => (Math.abs(size - n) < Math.abs(best - n) ? size : best), sizes[0]);

/** Node count, limited to the offered sizes: +/- step between them, or pick one directly. */
export function NodeStepper({
  value,
  onChange,
  sizes = NODE_SIZES,
}: {
  value: number;
  onChange: (nodes: number) => void;
  sizes?: readonly number[];
}): ReactElement {
  const labelId = useId();
  const at = sizes.indexOf(nearest(sizes, value));

  return (
    <div className={styles.group} role="group" aria-labelledby={labelId}>
      <p id={labelId} className={styles.legend}>
        Cluster size
      </p>
      <div className={styles.stepper}>
        <button
          type="button"
          className={styles.stepButton}
          aria-label="Smaller cluster"
          disabled={at <= 0}
          onClick={() => onChange(sizes[at - 1])}
        >
          −
        </button>
        <output className={styles.stepValue} aria-live="polite">
          <span className={styles.stepNumber}>{value.toLocaleString("en-US")}</span>
          <span className={styles.stepUnit}>nodes</span>
        </output>
        <button
          type="button"
          className={styles.stepButton}
          aria-label="Larger cluster"
          disabled={at >= sizes.length - 1}
          onClick={() => onChange(sizes[at + 1])}
        >
          +
        </button>
      </div>
      <Chips label="Cluster sizes" options={sizes} value={value} onChange={onChange} />
    </div>
  );
}

function Chips({
  label,
  options,
  value,
  onChange,
  format = (n) => n.toLocaleString("en-US"),
  flush = false,
}: {
  label: string;
  options: readonly number[];
  value: number;
  onChange: (n: number) => void;
  format?: (n: number) => string;
  flush?: boolean;
}): ReactElement {
  return (
    <div className={styles.presets} data-flush={flush || undefined} role="group" aria-label={label}>
      {options.map((n) => (
        <button key={n} type="button" className={styles.chip} aria-pressed={n === value} onClick={() => onChange(n)}>
          {format(n)}
        </button>
      ))}
    </div>
  );
}

/** One number from a short list of presets, with an optional price or note beside the legend. */
export function ChipPicker<F = Focus>({
  legend,
  options,
  value,
  onChange,
  format,
  note,
  focus,
  onPreview,
}: {
  legend: string;
  options: readonly number[];
  value: number;
  onChange: (n: number) => void;
  format?: (n: number) => string;
  note?: string;
  focus?: F;
  onPreview?: Preview<F>;
}): ReactElement {
  const labelId = useId();
  return (
    <div
      className={styles.group}
      role="group"
      aria-labelledby={labelId}
      {...(onPreview ? previewHandlers(focus, onPreview) : {})}
    >
      <div className={styles.groupHead}>
        <p id={labelId} className={styles.legend}>
          {legend}
        </p>
        {note ? <span className={styles.groupNote}>{note}</span> : null}
      </div>
      <Chips label={legend} options={options} value={value} onChange={onChange} format={format} flush />
    </div>
  );
}

/** Read-only values derived from the configuration. */
export function Readouts({
  items,
  detailLines,
}: {
  items: readonly { label: string; value: string; detail: string }[];
  /** Lines held for each detail, so values that change live never resize the cards. */
  detailLines?: number;
}): ReactElement {
  return (
    <div
      className={styles.readouts}
      style={detailLines ? ({ "--detail-lines": detailLines } as CSSProperties) : undefined}
    >
      {items.map((item) => (
        <div key={item.label} className={styles.readout}>
          <span className={styles.readoutLabel}>{item.label}</span>
          <span className={styles.readoutValue}>{item.value}</span>
          <span className={styles.readoutDetail}>{item.detail}</span>
        </div>
      ))}
    </div>
  );
}

/** N+1 checklist; an item whose prerequisite is off stays disabled. */
export function RedundancyList({
  choices,
  value,
  onChange,
  onPreview,
}: {
  choices: readonly RedundancyChoice[];
  value: readonly RedundancyId[];
  onChange: (ids: RedundancyId[]) => void;
  onPreview: Preview;
}): ReactElement {
  const headingId = useId();
  const allOn = choices.every((c) => value.includes(c.id));

  const toggle = (id: RedundancyId, on: boolean) => {
    const next = on ? [...value, id] : value.filter((v) => v !== id);
    const satisfied = (v: RedundancyId) => {
      const requires = choices.find((c) => c.id === v)?.requires;
      return !requires || next.includes(requires);
    };
    // Dropping a prerequisite drops whatever depends on it.
    onChange(next.filter(satisfied));
  };

  return (
    <div className={styles.group}>
      <div className={styles.groupHead}>
        <p id={headingId} className={styles.legend}>
          N+1 components
        </p>
        <button
          type="button"
          className={styles.textButton}
          onClick={() => onChange(allOn ? [] : choices.map((c) => c.id))}
        >
          {allOn ? "Clear all" : "Select all"}
        </button>
      </div>
      <div className={styles.cards} role="group" aria-labelledby={headingId}>
        {choices.map((choice) => {
          const blocked = choice.requires !== undefined && !value.includes(choice.requires);
          const checked = value.includes(choice.id) && !blocked;
          const needs = choices.find((c) => c.id === choice.requires)?.label;
          return (
            <label
              key={choice.id}
              className={`${styles.card} ${styles.checkCard}`}
              data-checked={checked || undefined}
              data-disabled={blocked || undefined}
              {...previewHandlers(choice.focus, onPreview)}
            >
              <input
                className={styles.input}
                type="checkbox"
                checked={checked}
                disabled={blocked}
                onChange={(event) => toggle(choice.id, event.target.checked)}
              />
              <span className={styles.tick} aria-hidden="true" />
              <span className={styles.cardLabel}>{choice.label}</span>
              <span className={styles.cardDetail}>{blocked && needs ? `Needs ${needs}` : choice.detail}</span>
              <span className={styles.cardNote}>+{usdShort(choice.price)} / ZODE</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
