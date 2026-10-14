"use client";

import { useState, type ReactElement } from "react";
import type { Scenario } from "../model/catalog";
import { DEFAULT_INBOUND, type InboundConfig } from "../model/inbound";
import { dockLoad } from "../model/inboundProcess";
import { NumberField } from "../ScenarioPanel";
import { number, percent } from "../format";
import factory from "../factory.module.css";

interface DockScenarioProps {
  scenario: Scenario;
  onRun: (scenario: Scenario) => void;
}

/** Edits a copy of the dock's setup; the whole factory re-runs on Run, so every flow sees it. */
export function DockScenario({ scenario, onRun }: DockScenarioProps): ReactElement {
  const [draft, setDraft] = useState(scenario.inbound);
  const set = (patch: Partial<InboundConfig>) => setDraft((d) => ({ ...d, ...patch }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(scenario.inbound);
  const load = dockLoad({ ...scenario, inbound: draft });
  const busiest = load.rows.reduce((a, b) => (b.need / (b.have || 1) > a.need / (a.have || 1) ? b : a));
  const share = busiest.need / (busiest.have || 1);
  const int = (key: keyof InboundConfig) => (v: number) => set({ [key]: Math.round(v) });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onRun({ ...scenario, inbound: draft });
      }}
    >
      <p className={factory.note}>
        Doors, crew and hours are placeholders for a dock not yet built. The line&apos;s release rate and reorder cycle,
        on the overview&apos;s scenario, set how much arrives.
      </p>

      <div className={factory.capacity} data-over={share > 0.85 ? "" : undefined}>
        <strong>{busiest.label}</strong> are the tightest, busy {percent(share)} of dock hours on an average week of{" "}
        {number(load.trucks.van + load.trucks.flatbed)} trucks
        {share > 0.85 ? ", so trucks will queue and wait." : "."}
      </div>

      <section className={factory.section} aria-label="Dock">
        <h2 className={factory.sectionTitle}>Dock</h2>
        <div className={factory.fieldGrid}>
          <NumberField label="Van doors" value={draft.vanDoors} min={1} max={12} step={1} onChange={int("vanDoors")} />
          <NumberField
            label="Flatbed bays"
            value={draft.flatbedBays}
            min={1}
            max={4}
            step={1}
            onChange={int("flatbedBays")}
          />
          <NumberField
            label="Yard stalls"
            value={draft.yardStalls}
            min={0}
            max={24}
            step={1}
            onChange={int("yardStalls")}
          />
          <NumberField
            label="Dock staging spots"
            value={draft.dockStaging}
            min={4}
            max={64}
            step={1}
            onChange={int("dockStaging")}
          />
          <NumberField
            label="Bay laydown spots"
            value={draft.bayLaydown}
            min={2}
            max={24}
            step={1}
            onChange={int("bayLaydown")}
          />
          <NumberField
            label="Put away first above (%)"
            value={Math.round(draft.highWater * 100)}
            min={30}
            max={100}
            step={5}
            onChange={(v) => set({ highWater: v / 100 })}
          />
        </div>
      </section>

      <section className={factory.section} aria-label="Crew and equipment">
        <h2 className={factory.sectionTitle}>Crew and equipment</h2>
        <div className={factory.fieldGrid}>
          <NumberField
            label="Handlers"
            value={draft.handlers}
            min={draft.craneCrew}
            max={20}
            step={1}
            onChange={int("handlers")}
          />
          <NumberField
            label="Crane crew"
            value={draft.craneCrew}
            min={1}
            max={Math.min(4, draft.handlers)}
            step={1}
            onChange={int("craneCrew")}
          />
          <NumberField
            label="Forklifts"
            value={draft.forklifts}
            min={1}
            max={12}
            step={1}
            onChange={int("forklifts")}
          />
          <NumberField
            label="Receiving clerks"
            value={draft.clerks}
            min={1}
            max={8}
            step={1}
            onChange={int("clerks")}
          />
          <NumberField
            label="QC inspectors"
            value={draft.inspectors}
            min={1}
            max={8}
            step={1}
            onChange={int("inspectors")}
          />
        </div>
      </section>

      <section className={factory.section} aria-label="Hours and carriers">
        <h2 className={factory.sectionTitle}>Hours and carriers</h2>
        <div className={factory.fieldGrid}>
          <NumberField
            label="Dock opens (h)"
            value={draft.opens}
            min={0}
            max={draft.closes - 4}
            step={1}
            onChange={int("opens")}
          />
          <NumberField
            label="Dock closes (h)"
            value={draft.closes}
            min={draft.opens + 4}
            max={24}
            step={1}
            onChange={int("closes")}
          />
          <NumberField
            label="Free time (h)"
            value={draft.freeHours}
            min={0}
            max={12}
            step={0.5}
            onChange={(v) => set({ freeHours: v })}
          />
          <NumberField
            label="Detention ($/h)"
            value={draft.detentionRate}
            min={0}
            max={500}
            step={5}
            onChange={(v) => set({ detentionRate: v })}
          />
          <NumberField
            label="Expedite lead (%)"
            value={Math.round(draft.expedite * 100)}
            min={10}
            max={100}
            step={5}
            onChange={(v) => set({ expedite: v / 100 })}
          />
        </div>
      </section>

      <div className={factory.formActions}>
        <button type="button" className={factory.secondaryButton} onClick={() => setDraft(DEFAULT_INBOUND)}>
          Defaults
        </button>
        <button type="submit" className={factory.primaryButton} disabled={!dirty}>
          Run simulation
        </button>
      </div>
    </form>
  );
}
