"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState, type ReactElement } from "react";
import { useInView } from "@/hooks/useInView";
import { TIMELINE, stepStart } from "./timeline";
import styles from "./AssemblyLine.module.css";

// three.js and the scene live in their own chunk, fetched only once the
// section nears the viewport; `ssr: false` keeps WebGL code off the server.
const AssemblyScene = dynamic(() => import("./AssemblyScene").then((mod) => mod.AssemblyScene), {
  ssr: false,
});

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
    <div ref={hostRef} className={styles.root} data-top-fade>
      {inView ? <AssemblyScene onStep={onStep} onTick={onTick} seek={seek} /> : null}

      <div className={styles.sideFade} aria-hidden="true" />

      <header className={styles.intro}>
        <h2 className={styles.title}>
          Built by robots
          <br />
          in North America.
        </h2>
        <div className={styles.flags} role="img" aria-label="United States and Canada">
          <svg className={styles.flag} viewBox="0 0 38 20" aria-hidden="true">
            <rect x="0" y="0" width="38" height="20" />
            <rect x="0" y="0" width="15.2" height="11.43" />
            <line x1="15.2" y1="2.86" x2="38" y2="2.86" />
            <line x1="15.2" y1="5.71" x2="38" y2="5.71" />
            <line x1="15.2" y1="8.57" x2="38" y2="8.57" />
            <line x1="15.2" y1="11.43" x2="38" y2="11.43" />
            <line x1="0" y1="14.29" x2="38" y2="14.29" />
            <line x1="0" y1="17.14" x2="38" y2="17.14" />
          </svg>
          <svg className={styles.flag} viewBox="0 0 40 20" aria-hidden="true">
            <rect x="0" y="0" width="40" height="20" />
            <line x1="10" y1="0" x2="10" y2="20" />
            <line x1="30" y1="0" x2="30" y2="20" />
            <path d="M20 3 L21.5 6 L23 5.2 L22.6 8.5 L25.5 7 L24.8 9.6 L26.5 10.2 L23.5 12.5 L24 14 L20.5 13.2 L20.5 17 L19.5 17 L19.5 13.2 L16 14 L16.5 12.5 L13.5 10.2 L15.2 9.6 L14.5 7 L17.4 8.5 L17 5.2 L18.5 6 Z" />
          </svg>
        </div>
      </header>

      <div ref={calloutRef} className={styles.callout}>
        <div key={`${cursor.stage}-${cursor.step}`} className={styles.phase}>
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
