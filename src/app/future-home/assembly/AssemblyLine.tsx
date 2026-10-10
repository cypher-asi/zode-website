"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState, type ReactElement } from "react";
import { useInView } from "@/lib/useInView";
import { TIMELINE, stepStart } from "./timeline";
import styles from "./AssemblyLine.module.css";

// three.js and the scene live in their own chunk, fetched only once the
// section nears the viewport; `ssr: false` keeps WebGL code off the server.
const AssemblyScene = dynamic(() => import("./AssemblyScene").then((mod) => mod.AssemblyScene), {
  ssr: false,
});

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * "How a ZODE is built" section: the autoplaying assembly-line scene, a
 * bottom-right callout showing the current step of the current stage with a
 * per-step progress bar, and a stage strip matching the hero's bottom bar.
 */
export function AssemblyLine(): ReactElement {
  const hostRef = useRef<HTMLDivElement>(null);
  const inView = useInView(hostRef, "300px 0px");
  const [cursor, setCursor] = useState({ stage: 0, step: 0 });
  const stageRef = useRef(0);
  const cellRefs = useRef<(HTMLLIElement | null)[]>([]);
  const calloutRef = useRef<HTMLDivElement>(null);
  const [seek, setSeek] = useState<{ time: number; id: number } | null>(null);

  const goTo = useCallback((stage: number, step = 0) => {
    setSeek((prev) => ({ time: stepStart(stage, step), id: (prev?.id ?? 0) + 1 }));
  }, []);

  const onStep = useCallback((stage: number, step: number) => {
    stageRef.current = stage;
    setCursor({ stage, step });
  }, []);

  // Per-frame progress goes straight to the DOM so the overlay never re-renders at 60 fps.
  const onTick = useCallback((stageProgress: number, stepProgress: number) => {
    cellRefs.current[stageRef.current]?.style.setProperty("--p", stageProgress.toFixed(4));
    calloutRef.current?.style.setProperty("--step-p", stepProgress.toFixed(4));
  }, []);

  const stage = TIMELINE.stages[cursor.stage];

  return (
    <div ref={hostRef} className={styles.root}>
      {inView ? <AssemblyScene onStep={onStep} onTick={onTick} seek={seek} /> : null}

      <div className={styles.sideFade} aria-hidden="true" />

      <header className={styles.intro}>
        <p className={styles.eyebrow}>Assembly line</p>
        <h2 className={styles.title}>
          Factory built,
          <br />
          pod by pod.
        </h2>
      </header>

      <div ref={calloutRef} className={styles.callout}>
        <div key={`${cursor.stage}-${cursor.step}`} className={styles.phase}>
          <span className={styles.phaseCount}>
            {pad(cursor.step + 1)} / {pad(stage.steps.length)}
          </span>
          <span className={styles.phaseLabel}>{stage.steps[cursor.step]}</span>
        </div>

        <ol className={styles.segments} aria-label={`${stage.title} steps`}>
          {stage.steps.map((label, i) => (
            <li key={`${i}-${label}`} className={styles.segmentItem}>
              <button
                type="button"
                className={styles.segment}
                data-state={i < cursor.step ? "done" : i === cursor.step ? "active" : undefined}
                aria-current={i === cursor.step ? "step" : undefined}
                aria-label={`Step ${i + 1}: ${label}`}
                title={label}
                onClick={() => goTo(cursor.stage, i)}
              />
            </li>
          ))}
        </ol>
      </div>

      <ol className={styles.bar} aria-label="Build stages">
        {TIMELINE.stages.map((s, i) => (
          <li
            key={s.id}
            ref={(node) => {
              cellRefs.current[i] = node;
            }}
            className={styles.cell}
            data-state={i < cursor.stage ? "done" : i === cursor.stage ? "active" : undefined}
          >
            <button
              type="button"
              className={styles.cellButton}
              aria-current={i === cursor.stage ? "step" : undefined}
              aria-label={`Stage ${s.number}: ${s.title}`}
              onClick={() => goTo(i)}
            >
              <span className={styles.fill} aria-hidden="true" />
              <span className={styles.cellNo}>{s.number}</span>
              <span className={styles.cellTitle}>{s.title}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
