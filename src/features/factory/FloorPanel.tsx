"use client";

import type { ReactElement, ReactNode } from "react";
import { MATERIALS, bottleneckOf, kitOf, podBill, stepOf } from "./model/catalog";
import { clockLabel, duration, number, percent, podName } from "./format";
import type { Selection } from "./scene/FactoryView";
import { STATES, STATE_LABELS, podAtStation, podPlace, type FloorStats, type Trace } from "./sim/trace";
import styles from "./factory.module.css";

interface FloorPanelProps {
  trace: Trace;
  stats: FloorStats;
  selection: Selection;
  onSelect: (selection: Selection) => void;
}

/** The floor at the playhead: output, the selected station or pod, every station's time, and the store. */
export function FloorPanel({ trace, stats, selection, onSelect }: FloorPanelProps): ReactElement {
  const { stations } = trace.scenario;
  const capacity = 168 / bottleneckOf(stations).hours;
  const bill = podBill(stations);
  return (
    <>
      <dl className={styles.kpis}>
        <Kpi label="Pods finished" value={number(stats.completed)} />
        <Kpi label="Last 7 days" value={number(stats.lastWeek)} detail={`of ${number(capacity)} capacity`} />
        <Kpi label="Lead time" value={stats.leadHours === null ? "–" : duration(stats.leadHours)} detail="order to yard" />
        <Kpi label="On the line" value={number(stats.wip)} detail={`${number(stats.backlog)} waiting`} />
      </dl>

      {selection ? <Details trace={trace} stats={stats} selection={selection} onClose={() => onSelect(null)} /> : null}

      <section className={styles.section} aria-label="Stations">
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Stations</h2>
          <span className={styles.sectionNote}>Time since day 1</span>
        </div>
        <ul className={styles.stations}>
          {stations.map((s, i) => {
            const st = stats.stations[i];
            return (
              <li key={s.code}>
                <button
                  type="button"
                  className={styles.stationRow}
                  aria-pressed={selection?.kind === "station" && selection.station === i}
                  onClick={() => onSelect({ kind: "station", station: i })}
                >
                  <span className={styles.stationName}>
                    <span className={styles.code}>{s.code}</span>
                    {s.label}
                    {stats.bottleneck === i ? <span className={styles.tag}>Bottleneck</span> : null}
                  </span>
                  <span className={styles.stationState} data-state={STATES[st.state]}>
                    {STATE_LABELS[STATES[st.state]]}
                  </span>
                  <ShareBar shares={st.shares} />
                </button>
              </li>
            );
          })}
        </ul>
        <ul className={styles.legend} aria-label="Legend">
          {STATES.map((s) => (
            <li key={s} data-state={s}>
              {STATE_LABELS[s]}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-label="Parts store">
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Parts store</h2>
          <span className={styles.sectionNote}>Pods&apos; worth on hand</span>
        </div>
        <ul className={styles.stock}>
          {MATERIALS.map((m, i) => {
            if (!bill[i]) return null;
            const share = trace.orderUpTo[i] ? stats.stock[i] / trace.orderUpTo[i] : 0;
            return (
              <li key={m.id} className={styles.stockRow} data-low={share < 0.2 ? "" : undefined}>
                <span className={styles.stockName}>{m.label}</span>
                <span className={styles.stockValue}>
                  {number(Math.floor(stats.stock[i] / bill[i]))}
                  <small> · {number(stats.stock[i])} units</small>
                </span>
                <span className={styles.meter}>
                  <span style={{ width: percent(share) }} />
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

function Kpi({ label, value, detail }: { label: string; value: string; detail?: string }): ReactElement {
  return (
    <div className={styles.kpi}>
      <dt>{label}</dt>
      <dd>
        {value}
        {detail ? <small>{detail}</small> : null}
      </dd>
    </div>
  );
}

function ShareBar({ shares }: { shares: readonly number[] }): ReactElement {
  return (
    <span className={styles.shares} aria-label={STATES.map((s, k) => `${STATE_LABELS[s]} ${percent(shares[k])}`).join(", ")}>
      {/* Working first, so the bars line up on what each station gets done. */}
      {[3, 1, 2, 4, 0].map((k) =>
        shares[k] > 0.001 ? <span key={k} data-state={STATES[k]} style={{ width: `${shares[k] * 100}%` }} /> : null,
      )}
    </span>
  );
}

function Details({
  trace,
  stats,
  selection,
  onClose,
}: {
  trace: Trace;
  stats: FloorStats;
  selection: NonNullable<Selection>;
  onClose: () => void;
}): ReactElement {
  const t = stats.t;
  const { stations } = trace.scenario;
  let title: string;
  let body: ReactElement;

  if (selection.kind === "station") {
    const i = selection.station;
    const s = stations[i];
    const st = stats.stations[i];
    const podIndex = podAtStation(trace, i, t);
    const pod = podIndex >= 0 ? trace.pods[podIndex] : null;
    const kit = kitOf(s);
    const progress = pod && t >= pod.start[i] ? Math.min(1, (t - pod.start[i]) / (pod.end[i] - pod.start[i])) : null;
    title = `${s.code} · ${s.label}`;
    body = (
      <dl className={styles.facts}>
        <Fact label="Builds">{stepOf(s)?.label ?? "Power-on, leak and network tests"}</Fact>
        <Fact label="Now">
          <span className={styles.stationState} data-state={STATES[st.state]}>
            {STATE_LABELS[STATES[st.state]]}
          </span>
        </Fact>
        <Fact label="Pod">
          {pod ? `${podName(pod.id)}${progress !== null ? ` · ${percent(progress)} built` : ""}` : "None"}
        </Fact>
        <Fact label="Crew">{`${s.crew} people`}</Fact>
        <Fact label="Work">{`${s.work[0]}–${s.work[2]} person-hours, typically ${s.work[1]}`}</Fact>
        {s.craneHours > 0 ? <Fact label="Crane">{`${s.craneHours} h per pod`}</Fact> : null}
        {s.rework ? <Fact label="Rework">{`${percent(s.rework.chance)} of pods, ${s.rework.work[1]} person-hours`}</Fact> : null}
        <Fact label="Kit">
          {kit.some(Boolean)
            ? MATERIALS.flatMap((m, k) => (kit[k] ? [`${kit[k]} × ${m.label.toLowerCase()}`] : [])).join(", ")
            : "None"}
        </Fact>
        <Fact label="Finished">{`${number(st.processed)} pods · working ${percent(st.shares[3])} of the time`}</Fact>
      </dl>
    );
  } else {
    const pod = trace.pods[selection.pod];
    title = podName(pod.id);
    const place = podPlace(pod, t);
    const yard = trace.flow.length;
    const where = (pos: number) => {
      const f = trace.flow[pos];
      return f.kind === "station" ? stations[f.station].code : `the lane after ${stations[f.station].code}`;
    };
    const location = !place
      ? "At receiving"
      : place.to === yard
        ? place.u < 1
          ? "Moving to the yard"
          : "Finished, in the yard"
        : place.u < 1
          ? `Moving to ${where(place.to)}`
          : `At ${where(place.to)}`;
    body = (
      <>
        <dl className={styles.facts}>
          <Fact label="Where">{location}</Fact>
          <Fact label="Ordered">{clockLabel(pod.released)}</Fact>
          <Fact label="Lead time">
            {pod.done <= t ? duration(pod.done - pod.released) : `${duration(t - pod.released)} so far`}
          </Fact>
        </dl>
        <ol className={styles.history}>
          {stations.map((s, i) => {
            const started = t >= pod.start[i];
            const finished = t >= pod.end[i];
            return (
              <li key={s.code} data-done={finished ? "" : undefined} data-active={started && !finished ? "" : undefined}>
                <span className={styles.code}>{s.code}</span>
                <span>{s.label}</span>
                <span className={styles.historyTime}>
                  {finished
                    ? `${duration(pod.end[i] - pod.start[i])}${pod.reworked[i] ? " · reworked" : ""}`
                    : started
                      ? `${percent((t - pod.start[i]) / (pod.end[i] - pod.start[i]))}`
                      : "–"}
                </span>
              </li>
            );
          })}
        </ol>
      </>
    );
  }

  return (
    <section className={styles.details} aria-label={title}>
      <div className={styles.detailsHead}>
        <h2 className={styles.detailsTitle}>{title}</h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
          </svg>
        </button>
      </div>
      {body}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
