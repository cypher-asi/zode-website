"use client";

import { useId, type ReactElement } from "react";
import {
  NODE_SIZES,
  snapNodes,
  usdShort,
  type Choice,
  type Focus,
  type RedundancyChoice,
  type RedundancyId,
} from "./config";
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

type Preview = (focus: Focus | null) => void;

/** Hover and keyboard focus both preview an option's part of the drawing. */
const previewHandlers = (focus: Focus | undefined, onPreview: Preview) => ({
  onMouseEnter: () => focus && onPreview(focus),
  onMouseLeave: () => onPreview(null),
  onFocus: () => focus && onPreview(focus),
  onBlur: () => onPreview(null),
});

/** Radio cards for one exclusive choice. */
export function ChoiceGroup<Id extends string>({
  legend,
  choices,
  value,
  onChange,
  onPreview,
}: {
  legend: string;
  choices: readonly Choice<Id>[];
  value: Id;
  onChange: (id: Id) => void;
  onPreview: Preview;
}): ReactElement {
  const name = useId();
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.cards}>
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
            <span className={styles.cardDetail}>{choice.detail}</span>
            {choice.note ? <span className={styles.cardNote}>{choice.note}</span> : null}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** A card that is always selected and cannot be changed. */
export function IncludedCard({
  legend,
  choice,
  onPreview,
}: {
  legend: string;
  choice: Choice<string>;
  onPreview: Preview;
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

/** Node count, limited to the offered sizes: +/- step between them, or pick one directly. */
export function NodeStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (nodes: number) => void;
}): ReactElement {
  const labelId = useId();
  const at = NODE_SIZES.indexOf(snapNodes(value) as (typeof NODE_SIZES)[number]);

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
          onClick={() => onChange(NODE_SIZES[at - 1])}
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
          disabled={at >= NODE_SIZES.length - 1}
          onClick={() => onChange(NODE_SIZES[at + 1])}
        >
          +
        </button>
      </div>
      <div className={styles.presets} role="group" aria-label="Cluster sizes">
        {NODE_SIZES.map((n) => (
          <button
            key={n}
            type="button"
            className={styles.chip}
            aria-pressed={n === value}
            onClick={() => onChange(n)}
          >
            {n.toLocaleString("en-US")}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Read-only values derived from the configuration. */
export function Readouts({
  items,
}: {
  items: readonly { label: string; value: string; detail: string }[];
}): ReactElement {
  return (
    <div className={styles.readouts}>
      {items.map((item) => (
        <div key={item.label} className={styles.readout}>
          <span className={styles.readoutLabel}>
            {item.label}
            <span className={styles.auto}>Auto</span>
          </span>
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
