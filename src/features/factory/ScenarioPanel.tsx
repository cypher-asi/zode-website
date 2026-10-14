"use client";

import { useState, type ReactElement } from "react";
import { DEFAULT_SCENARIO, bottleneckOf, type Scenario, type StationConfig } from "./model/catalog";
import { number } from "./format";
import styles from "./factory.module.css";

interface ScenarioPanelProps {
  scenario: Scenario;
  onRun: (scenario: Scenario) => void;
}

/** Edits a copy of the scenario; nothing re-runs until Run. */
export function ScenarioPanel({ scenario, onRun }: ScenarioPanelProps): ReactElement {
  const [draft, setDraft] = useState(scenario);
  const set = (patch: Partial<Scenario>) => setDraft((d) => ({ ...d, ...patch }));
  const setStation = (i: number, patch: Partial<StationConfig>) =>
    setDraft((d) => ({ ...d, stations: d.stations.map((s, k) => (k === i ? { ...s, ...patch } : s)) }));

  const bottleneck = bottleneckOf(draft.stations);
  const capacity = 168 / bottleneck.hours;
  const demand = 168 / draft.releaseEveryHours;
  const dirty = JSON.stringify(draft) !== JSON.stringify(scenario);

  return (
    <form
      className={styles.scenario}
      onSubmit={(e) => {
        e.preventDefault();
        onRun(draft);
      }}
    >
      <p className={styles.note}>
        Cycle times, crews and lead times are placeholders until the real factory&apos;s figures are in. Work is in
        person-hours, split across the crew.
      </p>

      <div className={styles.capacity} data-over={demand > capacity ? "" : undefined}>
        <strong>{number(capacity)} pods a week</strong> at most, set by {draft.stations[bottleneck.index].code} at{" "}
        {number(bottleneck.hours)} h a pod. Releases ask for {number(demand)}
        {demand > capacity ? ", so the backlog will grow." : "."}
      </div>

      <section className={styles.section} aria-label="Line">
        <h2 className={styles.sectionTitle}>Line</h2>
        <div className={styles.fieldGrid}>
          <NumberField label="Release every (h)" value={draft.releaseEveryHours} min={1} max={500} step={0.5} onChange={(v) => set({ releaseEveryHours: v })} />
          <NumberField label="Run length (days)" value={draft.horizonDays} min={7} max={365} step={1} onChange={(v) => set({ horizonDays: v })} />
          <NumberField label="Move per position (h)" value={draft.moveHours} min={0.05} max={12} step={0.05} onChange={(v) => set({ moveHours: v })} />
          <NumberField label="Kit pick + cart (h)" value={draft.kitHours} min={0.05} max={48} step={0.25} onChange={(v) => set({ kitHours: v })} />
          <NumberField label="Store cover (pods)" value={draft.coverPods} min={1} max={500} step={1} onChange={(v) => set({ coverPods: v })} />
          <NumberField label="Reorder every (h)" value={draft.reviewHours} min={1} max={2000} step={1} onChange={(v) => set({ reviewHours: v })} />
          <NumberField label="Random seed" value={draft.seed} min={1} max={1e9} step={1} onChange={(v) => set({ seed: Math.round(v) })} />
        </div>
      </section>

      <section className={styles.section} aria-label="Stations">
        <h2 className={styles.sectionTitle}>Stations</h2>
        <div className={styles.stationForms}>
          {draft.stations.map((s, i) => (
            <fieldset key={s.code} className={styles.stationForm}>
              <legend>
                <span className={styles.code}>{s.code}</span>
                {s.label}
              </legend>
              <div className={styles.fieldGrid}>
                <NumberField label="Crew" value={s.crew} min={1} max={30} step={1} onChange={(v) => setStation(i, { crew: Math.round(v) })} />
                <NumberField
                  label="Typical work (ph)"
                  value={s.work[1]}
                  min={0.1}
                  max={2000}
                  step={1}
                  onChange={(v) => setStation(i, { work: [Math.min(s.work[0], v), v, Math.max(s.work[2], v)] })}
                />
                <NumberField label="Least (ph)" value={s.work[0]} min={0.1} max={s.work[1]} step={1} onChange={(v) => setStation(i, { work: [v, s.work[1], s.work[2]] })} />
                <NumberField label="Most (ph)" value={s.work[2]} min={s.work[1]} max={4000} step={1} onChange={(v) => setStation(i, { work: [s.work[0], s.work[1], v] })} />
                {s.craneHours > 0 || DEFAULT_SCENARIO.stations[i]?.craneHours > 0 ? (
                  <NumberField label="Crane (h)" value={s.craneHours} min={0} max={48} step={0.25} onChange={(v) => setStation(i, { craneHours: v })} />
                ) : null}
                {i < draft.stations.length - 1 ? (
                  <NumberField label="Lane after (pods)" value={s.bufferAfter} min={0} max={4} step={1} onChange={(v) => setStation(i, { bufferAfter: Math.round(v) })} />
                ) : null}
                {s.rework ? (
                  <NumberField
                    label="Rework (%)"
                    value={Math.round(s.rework.chance * 100)}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(v) => setStation(i, { rework: { ...s.rework!, chance: v / 100 } })}
                  />
                ) : null}
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      <div className={styles.formActions}>
        <button type="button" className={styles.secondaryButton} onClick={() => setDraft(DEFAULT_SCENARIO)}>
          Defaults
        </button>
        <button type="button" className={styles.secondaryButton} onClick={() => set({ seed: Math.floor(Math.random() * 1e6) + 1 })}>
          New seed
        </button>
        <button type="submit" className={styles.primaryButton} disabled={!dirty}>
          Run simulation
        </button>
      </div>
    </form>
  );
}

/** A number input that keeps what's typed and reports only values within its range. */
export function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}): ReactElement {
  const [text, setText] = useState(String(value));
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    setText(String(value));
  }
  const parsed = Number(text);
  const invalid = text.trim() === "" || !Number.isFinite(parsed) || parsed < min || parsed > max;
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        className={styles.input}
        type="number"
        inputMode="decimal"
        value={text}
        min={min}
        max={max}
        step={step}
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          setText(e.target.value);
          const v = Number(e.target.value);
          if (e.target.value.trim() !== "" && Number.isFinite(v) && v >= min && v <= max) {
            setShown(v);
            onChange(v);
          }
        }}
      />
    </label>
  );
}
