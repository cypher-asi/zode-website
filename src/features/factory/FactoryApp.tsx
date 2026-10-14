"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { FloorPanel } from "./FloorPanel";
import { ScenarioPanel } from "./ScenarioPanel";
import { Transport } from "./Transport";
import { clockLabel } from "./format";
import { COMPUTE_POD, DEFAULT_SCENARIO, type Scenario } from "./model/catalog";
import type { FactorySceneHandle } from "./scene/FactoryScene";
import type { Selection } from "./scene/FactoryView";
import { simulate } from "./sim/simulate";
import { statsAt } from "./sim/trace";
import styles from "./factory.module.css";

const FactoryScene = dynamic(() => import("./scene/FactoryScene").then((m) => m.FactoryScene), {
  ssr: false,
  loading: () => null,
});

/** How often the panels catch up with the playhead while playing. */
const UI_MS = 120;
/** Where a still (reduced-motion) view opens: far enough in that the line is full. */
const STILL_AT = 10 * 24;

/**
 * The compute pod factory: the line simulated over the whole run up front,
 * the floor in 3D at the playhead, and the panels reading the same moment.
 */
export function FactoryApp(): ReactElement {
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO);
  const trace = useMemo(() => simulate(scenario), [scenario]);
  const horizon = trace.horizon;

  const sceneRef = useRef<FactorySceneHandle>(null);
  const timeRef = useRef(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);
  const [selection, setSelection] = useState<Selection>(null);
  const [cutaway, setCutaway] = useState(false);
  const [labels, setLabels] = useState(true);
  const [tab, setTab] = useState<"floor" | "scenario">("floor");

  const seek = useCallback(
    (t: number) => {
      const clamped = Math.min(Math.max(t, 0), horizon);
      timeRef.current = clamped;
      sceneRef.current?.setTime(clamped);
      setTime(clamped);
    },
    [horizon],
  );

  // Autoplay from the start, unless motion is reduced: then open on a full line, paused.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) seek(STILL_AT);
      else setPlaying(true);
    });
    return () => cancelAnimationFrame(raf);
    // Only on mount; a later scenario keeps the playhead where it is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = 0;
    let lastUi = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      let t = timeRef.current + dt * speed;
      const end = t >= horizon;
      if (end) t = horizon;
      timeRef.current = t;
      sceneRef.current?.setTime(t);
      if (end || now - lastUi > UI_MS) {
        lastUi = now;
        setTime(t);
      }
      if (end) {
        cancelAnimationFrame(raf);
        setPlaying(false);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, horizon]);

  const stats = useMemo(() => statsAt(trace, time), [trace, time]);
  const states = useMemo(() => stats.stations.map((s) => s.state), [stats]);
  const getTime = useCallback(() => timeRef.current, []);

  const run = (next: Scenario) => {
    setScenario(next);
    setSelection(null);
    seek(Math.min(timeRef.current, next.horizonDays * 24));
    setTab("floor");
  };

  return (
    <div className={styles.app}>
      <div className={styles.viewport}>
        <FactoryScene
          ref={sceneRef}
          trace={trace}
          getTime={getTime}
          selection={selection}
          cutaway={cutaway}
          labels={labels}
          states={states}
          onSelect={setSelection}
        />
        <header className={styles.head}>
          <p className={styles.eyebrow}>Factory · {COMPUTE_POD.title} line</p>
          <h1 className={styles.title}>{clockLabel(time)}</h1>
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
        <Transport
          time={time}
          horizon={horizon}
          playing={playing}
          speed={speed}
          onPlay={setPlaying}
          onSpeed={setSpeed}
          onSeek={seek}
        />
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
            <FloorPanel trace={trace} stats={stats} selection={selection} onSelect={setSelection} />
          ) : (
            <ScenarioPanel scenario={scenario} onRun={run} />
          )}
        </div>
      </aside>
    </div>
  );
}
