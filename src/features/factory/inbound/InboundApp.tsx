"use client";

import { startTransition, useState, type ReactElement } from "react";
import { AtPlayhead, useFactory } from "../FactoryProvider";
import { Transport } from "../Transport";
import { clockLabel } from "../format";
import type { Scenario } from "../model/catalog";
import { FLOOR_PHASES, HU_PHASE_LABELS, inboundStatsAt } from "../sim/inboundStats";
import { DockPanel } from "./DockPanel";
import { DockPlan } from "./DockPlan";
import { DockScenario } from "./DockScenario";
import { DockSchedule } from "./DockSchedule";
import { ProcessPanel } from "./ProcessPanel";
import type { DockSelection } from "./selection";
import factory from "../factory.module.css";
import styles from "./inbound.module.css";

type Tab = "dock" | "process" | "scenario";

const TABS: { id: Tab; label: string }[] = [
  { id: "dock", label: "Dock" },
  { id: "process", label: "Process" },
  { id: "scenario", label: "Scenario" },
];

/**
 * Inbound and receiving: the dock's plan and schedule at the playhead of the
 * factory's shared run, and the panels on its trucks, HUs, crew and process.
 */
export function InboundApp(): ReactElement {
  const { scenario, trace, run, playing, speed, setPlaying, setSpeed, seek, getTime, subscribe } = useFactory();
  const inbound = trace.inbound;
  const [selection, setSelection] = useState<DockSelection>(null);
  const [tab, setTab] = useState<Tab>("dock");
  // A new run ships different trucks, so a selection from the last one means nothing.
  const [selectionTrace, setSelectionTrace] = useState(trace);
  if (selectionTrace !== trace) {
    setSelectionTrace(trace);
    setSelection(null);
  }

  const rerun = (next: Scenario) => {
    startTransition(() => {
      run(next);
      setTab("dock");
    });
  };
  const select = (next: DockSelection) => {
    setSelection(next);
    if (next) setTab("dock");
  };

  return (
    <div className={`${factory.app} ${styles.inbound}`}>
      <div className={factory.viewport}>
        <header className={factory.head}>
          <p className={factory.eyebrow}>Factory · Inbound and receiving</p>
          <AtPlayhead>{(time) => <h1 className={factory.title}>{clockLabel(time)}</h1>}</AtPlayhead>
          <p className={factory.subtitle}>
            {inbound.config.vanDoors} van doors · {inbound.config.flatbedBays} flatbed bay
            {inbound.config.flatbedBays === 1 ? "" : "s"} ·{" "}
            <AtPlayhead>
              {(time) => {
                const onSite = inbound.trucks.filter((tr) => tr.arrive <= time && tr.departed > time).length;
                const onTheWay = inbound.trucks.filter((tr) => tr.ordered <= time && tr.arrive > time).length;
                return `${onSite} trucks on site, ${onTheWay} on the way`;
              }}
            </AtPlayhead>
          </p>
        </header>
        <ul className={styles.legend} aria-label="HU legend">
          {FLOOR_PHASES.map((p) => (
            <li key={p} data-phase={p}>
              {HU_PHASE_LABELS[p]}
            </li>
          ))}
        </ul>
        <div className={styles.stage}>
          <DockPlan trace={inbound} getTime={getTime} subscribe={subscribe} selection={selection} onSelect={select} />
          <AtPlayhead>
            {(time) => <DockSchedule trace={inbound} time={time} selection={selection} onSelect={select} />}
          </AtPlayhead>
        </div>
        <AtPlayhead>
          {(time) => (
            <Transport
              time={time}
              horizon={trace.horizon}
              playing={playing}
              speed={speed}
              onPlay={setPlaying}
              onSpeed={setSpeed}
              onSeek={seek}
            />
          )}
        </AtPlayhead>
      </div>

      <aside className={factory.side}>
        <div className={factory.tabs} role="tablist" aria-label="Panel">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={factory.tab}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className={factory.sideBody}>
          {tab === "dock" ? (
            <AtPlayhead>
              {(time) => (
                <DockPanel trace={inbound} stats={inboundStatsAt(inbound, time)} selection={selection} onSelect={select} />
              )}
            </AtPlayhead>
          ) : tab === "process" ? (
            <ProcessPanel scenario={scenario} />
          ) : (
            <DockScenario scenario={scenario} onRun={rerun} />
          )}
        </div>
      </aside>
    </div>
  );
}
