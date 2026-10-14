"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, type ReactElement, type Ref } from "react";
import { usePortalTheme } from "@/features/portal/PortalFrame";
import { STATES, type Trace } from "../sim/trace";
import { FactoryView, ZONE_LABELS, labelAnchors, type Selection } from "./FactoryView";
import styles from "../factory.module.css";

export interface FactorySceneHandle {
  setTime: (t: number) => void;
  fit: () => void;
  rotate: () => void;
}

export interface FactorySceneProps {
  ref?: Ref<FactorySceneHandle>;
  trace: Trace;
  /** Read once on mount; later times go through the handle. */
  getTime: () => number;
  selection: Selection;
  cutaway: boolean;
  labels: boolean;
  /** Per station, its state index (STATES). */
  states: readonly number[];
  onSelect: (selection: Selection) => void;
}

/** Hosts the WebGL view and its labels; everything after mount goes through `FactoryView`. */
export function FactoryScene({
  ref,
  trace,
  getTime,
  selection,
  cutaway,
  labels,
  states,
  onSelect,
}: FactorySceneProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<(HTMLElement | null)[]>([]);
  const viewRef = useRef<FactoryView | null>(null);
  const callbacks = useRef({ onSelect, getTime });
  const { theme } = usePortalTheme();

  useEffect(() => {
    callbacks.current = { onSelect, getTime };
  });

  useImperativeHandle(
    ref,
    () => ({
      setTime: (t) => viewRef.current?.setTime(t),
      fit: () => viewRef.current?.fit(),
      rotate: () => viewRef.current?.rotate(),
    }),
    [],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let view: FactoryView;
    try {
      view = new FactoryView(container, {
        onSelect: (s) => callbacks.current.onSelect(s),
        onProject: (xy) => {
          labelRefs.current.forEach((el, i) => {
            if (el) el.style.transform = `translate(${xy[i * 2].toFixed(1)}px, ${xy[i * 2 + 1].toFixed(1)}px)`;
          });
        },
      });
    } catch {
      return;
    }
    viewRef.current = view;
    return () => {
      view.dispose();
      viewRef.current = null;
    };
  }, []);

  const anchors = useMemo(() => labelAnchors(trace).points, [trace]);
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.setTrace(trace);
    view.setAnchors(anchors);
    view.setTime(callbacks.current.getTime());
  }, [trace, anchors]);

  useEffect(() => viewRef.current?.setSelection(selection), [selection]);
  useEffect(() => viewRef.current?.setCutaway(cutaway), [cutaway]);
  useEffect(() => viewRef.current?.paint(), [theme]);

  const stations = trace.scenario.stations;
  return (
    <div className={styles.scene}>
      <div ref={containerRef} className={styles.canvas} />
      <div className={styles.labels} hidden={!labels} aria-hidden="true">
        {stations.map((s, i) => (
          <span
            key={s.code}
            ref={(el) => {
              labelRefs.current[i] = el;
            }}
            className={styles.label}
            data-state={STATES[states[i] ?? 0]}
            data-selected={selection?.kind === "station" && selection.station === i ? "" : undefined}
          >
            <span className={styles.labelCode}>{s.code}</span>
            {s.label}
          </span>
        ))}
        {ZONE_LABELS.map((name, i) => (
          <span
            key={name}
            ref={(el) => {
              labelRefs.current[stations.length + i] = el;
            }}
            className={styles.label}
            data-zone=""
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
