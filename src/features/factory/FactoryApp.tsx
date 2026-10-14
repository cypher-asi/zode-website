"use client";

import dynamic from "next/dynamic";
import { startTransition, useEffect, useRef, useState, type ReactElement } from "react";
import { AtPlayhead, useFactory } from "./FactoryProvider";
import { FloorPanel } from "./FloorPanel";
import { ScenarioPanel } from "./ScenarioPanel";
import { Transport } from "./Transport";
import { clockLabel } from "./format";
import { COMPUTE_POD, type Scenario } from "./model/catalog";
import type { FactorySceneHandle } from "./scene/FactoryScene";
import type { Selection } from "./scene/FactoryView";
import { stationStateAt, statsAt } from "./sim/trace";
import styles from "./factory.module.css";

const FactoryScene = dynamic(() => import("./scene/FactoryScene").then((m) => m.FactoryScene), {
  ssr: false,
  loading: () => null,
});

/**
 * The compute pod factory's overview: the floor in 3D at the playhead, and
 * the panels reading the same moment of the shared run.
 */
export function FactoryApp(): ReactElement {
  const { scenario, trace, run, playing, speed, setPlaying, setSpeed, seek, getTime, subscribe } = useFactory();
  const sceneRef = useRef<FactorySceneHandle>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [cutaway, setCutaway] = useState(false);
  const [labels, setLabels] = useState(true);
  const [tab, setTab] = useState<"floor" | "scenario">("floor");
  // A new run renumbers its pods, so a selection from the last one means nothing.
  const [selectionTrace, setSelectionTrace] = useState(trace);
  if (selectionTrace !== trace) {
    setSelectionTrace(trace);
    setSelection(null);
  }

  useEffect(() => subscribe((t) => sceneRef.current?.setTime(t)), [subscribe]);

  const rerun = (next: Scenario) => {
    startTransition(() => {
      run(next);
      setTab("floor");
    });
  };

  return (
    <div className={styles.app}>
      <div className={styles.viewport}>
        <AtPlayhead>
          {(time) => (
            <FactoryScene
              ref={sceneRef}
              trace={trace}
              getTime={getTime}
              selection={selection}
              cutaway={cutaway}
              labels={labels}
              states={trace.stations.map((series) => stationStateAt(series, time))}
              onSelect={setSelection}
            />
          )}
        </AtPlayhead>
        <header className={styles.head}>
          <p className={styles.eyebrow}>Factory · {COMPUTE_POD.title} line</p>
          <AtPlayhead>{(time) => <h1 className={styles.title}>{clockLabel(time)}</h1>}</AtPlayhead>
          <p className={styles.subtitle}>
            {trace.scenario.stations.length} stations · a pod order every {trace.scenario.releaseEveryHours} h
          </p>
        </header>
        <div className={styles.tools} role="toolbar" aria-label="View">
          <button type="button" className={styles.tool} aria-pressed={cutaway} onClick={() => setCutaway((c) => !c)}>
            Cutaway
          </button>
          <button type="button" className={styles.tool} aria-pressed={labels} onClick={() => setLabels((l) => !l)}>
            Labels
          </button>
          <span className={styles.toolDivider} />
          <button type="button" className={styles.tool} onClick={() => sceneRef.current?.rotate()}>
            Rotate
          </button>
          <button type="button" className={styles.tool} onClick={() => sceneRef.current?.fit()}>
            Fit
          </button>
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

      <aside className={styles.side}>
        <div className={styles.tabs} role="tablist" aria-label="Panel">
          <button type="button" role="tab" aria-selected={tab === "floor"} className={styles.tab} onClick={() => setTab("floor")}>
            Floor
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "scenario"}
            className={styles.tab}
            onClick={() => setTab("scenario")}
          >
            Scenario
          </button>
        </div>
        <div className={styles.sideBody}>
          {tab === "floor" ? (
            <AtPlayhead>
              {(time) => (
                <FloorPanel trace={trace} stats={statsAt(trace, time)} selection={selection} onSelect={setSelection} />
              )}
            </AtPlayhead>
          ) : (
            <ScenarioPanel scenario={scenario} onRun={rerun} />
          )}
        </div>
      </aside>
    </div>
  );
}
