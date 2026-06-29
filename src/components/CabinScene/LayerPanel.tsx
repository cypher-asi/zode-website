"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import { CATEGORIES, type CategoryDef } from "./cabinModel";
import styles from "./CabinScene.module.css";

export type RenderStyle = "line" | "realistic";

const STYLE_OPTIONS: ReadonlyArray<{ value: RenderStyle; label: string }> = [
  { value: "line", label: "Line" },
  { value: "realistic", label: "Realistic" },
];

/** Checkbox that supports the indeterminate (mixed) visual state. */
function TriCheckbox({
  checked,
  indeterminate,
  onChange,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  "aria-label"?: string;
}): ReactElement {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate) && !checked;
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={ariaLabel}
    />
  );
}

function Category({
  category,
  subs,
  layers,
  onToggleLayer,
  onSetMany,
}: {
  category: CategoryDef;
  subs: CategoryDef["subs"];
  layers: Record<string, boolean>;
  onToggleLayer: (id: string) => void;
  onSetMany: (ids: string[], value: boolean) => void;
}): ReactElement {
  const [open, setOpen] = useState(true);
  const ids = subs.map((s) => s.id);
  const onCount = ids.filter((id) => layers[id] ?? true).length;
  const allOn = onCount === ids.length;
  const someOn = onCount > 0;

  return (
    <li className={styles.category}>
      <div className={styles.categoryHead}>
        <button
          type="button"
          className={styles.caret}
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} ${category.label}`}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "\u25be" : "\u25b8"}
        </button>
        <label className={styles.categoryLabel}>
          <TriCheckbox
            checked={allOn}
            indeterminate={someOn}
            onChange={() => onSetMany(ids, !allOn)}
            aria-label={category.label}
          />
          <span>{category.label}</span>
        </label>
      </div>
      {open && (
        <ul className={styles.subList}>
          {subs.map((sub) => (
            <li key={sub.id}>
              <label className={styles.layerRow}>
                <input
                  type="checkbox"
                  checked={layers[sub.id] ?? true}
                  onChange={() => onToggleLayer(sub.id)}
                />
                <span>{sub.label}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function LayerPanel({
  style,
  onStyleChange,
  layers,
  available,
  onToggleLayer,
  onSetMany,
}: {
  style: RenderStyle;
  onStyleChange: (style: RenderStyle) => void;
  layers: Record<string, boolean>;
  /** Sub-layer ids that exist in the loaded model. */
  available: string[];
  onToggleLayer: (id: string) => void;
  onSetMany: (ids: string[], value: boolean) => void;
}): ReactElement {
  const [open, setOpen] = useState(false);

  const availableSet = new Set(available);
  const categories = CATEGORIES.map((cat) => ({
    ...cat,
    subs: cat.subs.filter((s) => availableSet.has(s.id)),
  })).filter((cat) => cat.subs.length > 0);

  return (
    <div className={styles.panel} role="group" aria-label="Model display options">
      <button
        type="button"
        className={styles.panelToggle}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>Display</span>
        <span className={styles.panelToggleIcon} aria-hidden="true">
          {open ? "\u25be" : "\u25b8"}
        </span>
      </button>

      {open && (
        <div className={styles.panelBody}>
          <p className={styles.panelTitle}>Style</p>
          <div
            className={styles.styleToggle}
            role="radiogroup"
            aria-label="Render style"
          >
            {STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={style === opt.value}
                data-active={style === opt.value || undefined}
                className={styles.styleButton}
                onClick={() => onStyleChange(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <p className={styles.panelTitle}>Layers</p>
          <ul className={styles.layerList}>
            {categories.map((cat) => (
              <Category
                key={cat.id}
                category={cat}
                subs={cat.subs}
                layers={layers}
                onToggleLayer={onToggleLayer}
                onSetMany={onSetMany}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
