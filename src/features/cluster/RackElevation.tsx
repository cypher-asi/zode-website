"use client";

import type { CSSProperties, ReactElement } from "react";
import { power } from "./format";
import { KIND_LABELS, LAYER_OF } from "./model/catalog";
import type { Rack } from "./model/types";
import styles from "./RackElevation.module.css";

/**
 * The selected rack drawn front-on, one rack unit at a time, with the
 * selected part's details below; picking a part here or in the viewport
 * selects it in both.
 */
export function RackElevation({
  rack,
  partId,
  onSelectPart,
  onClose,
}: {
  rack: Rack;
  partId: string | null;
  onSelectPart: (partId: string | null) => void;
  onClose: () => void;
}): ReactElement {
  const part = rack.parts.find((p) => p.id === partId) ?? null;
  const used = rack.parts.reduce((n, p) => n + p.uSize, 0);

  return (
    <aside className={styles.root} aria-label={`${rack.name} elevation`}>
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>{rack.kind === "compute" ? "Compute rack" : "Network rack"}</p>
          <h2 className={styles.title}>{rack.name}</h2>
        </div>
        <button type="button" className={styles.close} aria-label="Close rack" onClick={onClose}>
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2 2l8 8M10 2l-8 8" />
          </svg>
        </button>
      </header>

      <dl className={styles.facts}>
        <div>
          <dt>Power</dt>
          <dd>{power(rack.kw)}</dd>
        </div>
        <div>
          <dt>Used</dt>
          <dd>
            {used} / {rack.uHeight}U
          </dd>
        </div>
        <div>
          <dt>PDUs</dt>
          <dd>2, A + B</dd>
        </div>
      </dl>

      <div className={styles.elevation} style={{ "--units": rack.uHeight } as CSSProperties}>
        {rack.parts.map((p) => (
          <button
            key={p.id}
            type="button"
            className={styles.unit}
            data-layer={LAYER_OF[p.kind]}
            data-short={p.uSize === 1 || undefined}
            aria-label={`${p.label}, U${p.uStart}`}
            aria-pressed={p.id === partId}
            style={{ gridRow: `${rack.uHeight - (p.uStart + p.uSize - 1) + 1} / span ${p.uSize}` }}
            onClick={() => onSelectPart(p.id === partId ? null : p.id)}
          >
            <span className={styles.unitNo}>U{p.uStart}</span>
            <span className={styles.unitLabel}>{p.uSize > 1 ? p.label : KIND_LABELS[p.kind]}</span>
          </button>
        ))}
      </div>

      {part ? (
        <section className={styles.detail} aria-live="polite">
          <p className={styles.eyebrow}>
            {KIND_LABELS[part.kind]} · U{part.uStart}
            {part.uSize > 1 ? `–${part.uStart + part.uSize - 1}` : ""}
          </p>
          <h3 className={styles.partTitle}>{part.label}</h3>
          <p className={styles.model}>{part.model}</p>
          <dl className={styles.specs}>
            {part.specs.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
            {part.kw ? (
              <div>
                <dt>Draw</dt>
                <dd>{power(part.kw)}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : (
        <p className={styles.hint}>Select a unit to see what it is.</p>
      )}
    </aside>
  );
}
