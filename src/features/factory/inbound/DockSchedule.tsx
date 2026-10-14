"use client";

import type { CSSProperties, ReactElement } from "react";
import { SLOT_HOURS, SUPPLIERS, type TruckKind } from "../model/inbound";
import type { InboundTrace } from "../sim/inbound";
import { truckName } from "../sim/inboundStats";
import { planLayout } from "./plan";
import type { DockSelection } from "./selection";
import styles from "./inbound.module.css";

/** The window the schedule shows around the playhead, in hours. */
const BEFORE = 18;
const AFTER = 8;

interface DockScheduleProps {
  trace: InboundTrace;
  time: number;
  selection: DockSelection;
  onSelect: (selection: DockSelection) => void;
}

/**
 * The dock's day as a schedule: each door's trucks so far (docking,
 * unloading, checks and BOL), and the booked appointments ahead by kind of
 * door, over the hours either side of the playhead. Dock hours are shaded.
 */
export function DockSchedule({ trace, time, selection, onSelect }: DockScheduleProps): ReactElement {
  const cfg = trace.config;
  const doors = planLayout(cfg).doors;
  const t0 = time - BEFORE;
  const t1 = time + AFTER;
  const span = t1 - t0;
  const at = (t: number) => `${((Math.min(Math.max(t, t0), t1) - t0) / span) * 100}%`;
  const width = (a: number, b: number) => `${((Math.min(b, t1) - Math.max(a, t0)) / span) * 100}%`;

  const hours: number[] = [];
  for (let h = Math.ceil(t0 / 6) * 6; h <= t1; h += 6) hours.push(h);
  const closed: [number, number][] = [];
  for (let d = Math.floor(t0 / 24) - 1; d * 24 < t1; d++) {
    const a = Math.max(t0, d * 24 + cfg.closes);
    const b = Math.min(t1, (d + 1) * 24 + cfg.opens);
    if (b > a) closed.push([a, b]);
  }
  const selected = selection?.kind === "truck" ? selection.truck : -1;

  const booked = (kind: TruckKind) =>
    trace.trucks
      .map((tr, i) => ({ tr, i }))
      .filter(
        ({ tr }) =>
          tr.kind === kind && tr.appointment + SLOT_HOURS[kind] > t0 && tr.appointment < t1 && tr.ordered <= time,
      );

  return (
    <div
      className={styles.schedule}
      role="group"
      aria-label="Dock schedule"
      style={{ "--now": `${(BEFORE / span) * 100}%` } as CSSProperties}
    >
      <div className={styles.scheduleAxis} aria-hidden="true">
        <span className={styles.rowLabel} />
        <div className={styles.track}>
          {hours.map((h) => (
            <span key={h} className={styles.hourTick} style={{ left: at(h) }}>
              {String(((h % 24) + 24) % 24).padStart(2, "0")}:00
            </span>
          ))}
        </div>
      </div>
      {(["van", "flatbed"] as const).map((kind) =>
        (kind === "van" ? cfg.vanDoors : cfg.flatbedBays) ? (
          <div key={kind} className={styles.scheduleRow}>
            <span className={styles.rowLabel}>{kind === "van" ? "Van slots" : "Bay slots"}</span>
            <div className={styles.track}>
              <Shading closed={closed} at={at} width={width} />
              {booked(kind).map(({ tr, i }) => (
                <button
                  type="button"
                  key={i}
                  className={styles.booking}
                  data-late={tr.arrive > time && time > tr.appointment ? "" : undefined}
                  data-arrived={tr.arrive <= time || undefined}
                  aria-pressed={i === selected}
                  style={{
                    left: at(tr.appointment),
                    width: width(tr.appointment, tr.appointment + SLOT_HOURS[kind]),
                  }}
                  onClick={() => onSelect({ kind: "truck", truck: i })}
                  title={`${truckName(tr)} · ${SUPPLIERS[tr.supplier].label}`}
                />
              ))}
            </div>
          </div>
        ) : null,
      )}
      {doors.map((d, door) => (
        <div key={d.name} className={styles.scheduleRow}>
          <span className={styles.rowLabel}>{d.name}</span>
          <div className={styles.track}>
            <Shading closed={closed} at={at} width={width} />
            {trace.trucks.map((tr, i) => {
              if (tr.door !== door || tr.docked > time || tr.departed < t0 || tr.docked > t1) return null;
              const end = Math.min(tr.departed, time);
              const parts: [string, number, number][] = [
                ["docking", tr.docked, tr.ready],
                ["unloading", tr.ready, tr.unloadEnd],
                ["paperwork", tr.unloadEnd, tr.released],
                ["departing", tr.released, tr.departed],
              ];
              return (
                <button
                  type="button"
                  key={i}
                  className={styles.visit}
                  aria-pressed={i === selected}
                  style={{ left: at(tr.docked), width: width(tr.docked, end) }}
                  onClick={() => onSelect({ kind: "truck", truck: i })}
                  title={`${truckName(tr)} · ${SUPPLIERS[tr.supplier].label}`}
                >
                  {parts.map(([phase, a, b]) =>
                    a < end ? (
                      <span
                        key={phase}
                        data-phase={phase}
                        style={
                          {
                            flexGrow: Math.max(0, Math.min(b, end) - a),
                          } as CSSProperties
                        }
                      />
                    ) : null,
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Shading({
  closed,
  at,
  width,
}: {
  closed: [number, number][];
  at: (t: number) => string;
  width: (a: number, b: number) => string;
}): ReactElement {
  return (
    <>
      {closed.map(([a, b]) => (
        <span key={a} className={styles.closed} style={{ left: at(a), width: width(a, b) }} />
      ))}
    </>
  );
}
