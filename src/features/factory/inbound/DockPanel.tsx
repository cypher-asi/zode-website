"use client";

import type { ReactElement } from "react";
import { MATERIALS } from "../model/catalog";
import { HANDLING, SUPPLIERS, ZONE_LABELS } from "../model/inbound";
import { Fact, Kpi } from "../FloorPanel";
import { clockLabel, duration, number, percent } from "../format";
import { DAMAGED, REJECTED, RESOURCES, STOCKED, type InboundTrace, type Resource } from "../sim/inbound";
import {
  FLOOR_PHASES,
  HU_PHASE_LABELS,
  TRUCK_PHASE_LABELS,
  detentionOf,
  huName,
  huPhase,
  truckName,
  truckPhase,
  type InboundStats,
} from "../sim/inboundStats";
import { planLayout } from "./plan";
import type { DockSelection } from "./selection";
import factory from "../factory.module.css";
import styles from "./inbound.module.css";

interface DockPanelProps {
  trace: InboundTrace;
  stats: InboundStats;
  selection: DockSelection;
  onSelect: (selection: DockSelection) => void;
}

const RESOURCE_LABELS: Record<Resource | "doors", string> = {
  doors: "Doors and bays",
  guard: "Gate guard",
  handlers: "Handlers",
  forklifts: "Forklifts",
  cranes: "Bay cranes",
  clerks: "Receiving clerks",
  inspectors: "QC inspectors",
};

/** The dock at the playhead: its figures, the selection, doors, yard, floor, crew and exceptions. */
export function DockPanel({ trace, stats, selection, onSelect }: DockPanelProps): ReactElement {
  const cfg = trace.config;
  const t = stats.t;
  const doors = planLayout(cfg).doors;
  const rate = cfg.detentionRate;

  const waiting = trace.trucks
    .map((tr, i) => ({ tr, i, phase: truckPhase(tr, t) }))
    .filter(({ phase }) => phase === "gate" || phase === "holding" || phase === "stall")
    .sort((a, b) => a.tr.appointment - b.tr.appointment);
  const next = trace.trucks
    .map((tr, i) => ({ tr, i }))
    .filter(({ tr }) => tr.ordered <= t && tr.arrive > t)
    .sort((a, b) => a.tr.appointment - b.tr.appointment)
    .slice(0, 6);
  const exceptions = trace.hus
    .map((hu, i) => ({
      hu,
      i,
      at: hu.outcome === DAMAGED ? hu.checked : hu.outcome === REJECTED ? hu.qcEnd : Infinity,
    }))
    .filter(({ at }) => at <= t)
    .sort((a, b) => b.at - a.at)
    .slice(0, 6);
  const capacity: Record<Resource | "doors", number> = {
    doors: doors.length,
    guard: 1,
    handlers: cfg.handlers,
    forklifts: cfg.forklifts,
    cranes: cfg.flatbedBays,
    clerks: cfg.clerks,
    inspectors: cfg.inspectors,
  };

  return (
    <>
      <dl className={factory.kpis}>
        <Kpi
          label="Trucks turned"
          value={number(stats.departed)}
          detail={stats.turnHours === null ? "gate to out" : `${duration(stats.turnHours)} gate to out`}
        />
        <Kpi
          label="On time"
          value={stats.onTime === null ? "–" : percent(stats.onTime)}
          detail="within 30 min of the slot"
        />
        <Kpi
          label="Dock to stock"
          value={stats.dockToStock === null ? "–" : duration(stats.dockToStock)}
          detail={`${number(stats.stockedUnits)} units in`}
        />
        <Kpi
          label="Detention"
          value={`$${number(Math.round(stats.detentionHours * rate))}`}
          detail={`${number(stats.detentionHours)} h past ${cfg.freeHours} h free`}
        />
      </dl>

      {selection ? <Details trace={trace} t={t} selection={selection} onSelect={onSelect} /> : null}

      <section className={factory.section} aria-label="Doors">
        <div className={factory.sectionHead}>
          <h2 className={factory.sectionTitle}>Doors</h2>
          <span className={factory.sectionNote}>
            Open {String(cfg.opens).padStart(2, "0")}:00–
            {String(cfg.closes).padStart(2, "0")}:00
          </span>
        </div>
        <ul className={styles.rows}>
          {doors.map((d, k) => {
            const i = stats.doors[k];
            const tr = i >= 0 ? trace.trucks[i] : null;
            const off = tr ? tr.hus.filter((h) => trace.hus[h].unloaded <= t).length : 0;
            const phase = tr ? truckPhase(tr, t) : null;
            return (
              <li key={d.name}>
                <button
                  type="button"
                  className={styles.row}
                  disabled={!tr}
                  aria-pressed={selection?.kind === "truck" && selection.truck === i}
                  onClick={() => tr && onSelect({ kind: "truck", truck: i })}
                >
                  <span className={styles.rowName}>
                    <span className={factory.code}>{d.name}</span>
                    {tr ? `${truckName(tr)} · ${SUPPLIERS[tr.supplier].label}` : "Empty"}
                  </span>
                  {phase ? (
                    <span className={styles.phase} data-phase={phase}>
                      {TRUCK_PHASE_LABELS[phase]}
                    </span>
                  ) : null}
                  {tr ? (
                    <span className={factory.meter}>
                      <span style={{ width: percent(off / tr.hus.length) }} />
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={factory.section} aria-label="Yard and gate">
        <div className={factory.sectionHead}>
          <h2 className={factory.sectionTitle}>Yard and gate</h2>
          <span className={factory.sectionNote}>
            {stats.trucks.stall} of {cfg.yardStalls} stalls · {stats.trucks.gate + stats.trucks.holding} at the gate
          </span>
        </div>
        {waiting.length ? (
          <ul className={styles.rows}>
            {waiting.slice(0, 8).map(({ tr, i, phase }) => (
              <li key={i}>
                <button
                  type="button"
                  className={styles.row}
                  aria-pressed={selection?.kind === "truck" && selection.truck === i}
                  onClick={() => onSelect({ kind: "truck", truck: i })}
                >
                  <span className={styles.rowName}>
                    <span className={factory.code}>{truckName(tr)}</span>
                    {SUPPLIERS[tr.supplier].label}
                    {tr.expedite ? <span className={factory.tag}>Expedite</span> : null}
                  </span>
                  <span className={styles.phase} data-phase={phase}>
                    {TRUCK_PHASE_LABELS[phase]} · {duration(t - tr.arrive)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={factory.note}>No trucks waiting.</p>
        )}
      </section>

      <section className={factory.section} aria-label="Receiving floor">
        <div className={factory.sectionHead}>
          <h2 className={factory.sectionTitle}>Receiving floor</h2>
          <span className={factory.sectionNote}>HUs waiting, by step</span>
        </div>
        <ul className={factory.stock}>
          <Meter label="Dock staging" value={stats.staged[0]} of={cfg.dockStaging} high={cfg.highWater} />
          {cfg.flatbedBays ? (
            <Meter label="Bay laydown" value={stats.staged[1]} of={cfg.bayLaydown} high={cfg.highWater} />
          ) : null}
        </ul>
        <ul className={styles.phaseCounts}>
          {FLOOR_PHASES.map((p) => (
            <li key={p} data-phase={p}>
              <span>{HU_PHASE_LABELS[p]}</span>
              <strong>{number(stats.hus[p])}</strong>
            </li>
          ))}
        </ul>
      </section>

      <section className={factory.section} aria-label="Crew and equipment">
        <div className={factory.sectionHead}>
          <h2 className={factory.sectionTitle}>Crew and equipment</h2>
          <span className={factory.sectionNote}>Busy, last 7 days of dock hours</span>
        </div>
        <ul className={factory.stock}>
          {(["doors", ...RESOURCES] as const).map((r) =>
            capacity[r] ? (
              <li key={r} className={factory.stockRow} data-low={stats.utilization[r] > 0.85 ? "" : undefined}>
                <span className={factory.stockName}>
                  {RESOURCE_LABELS[r]} <small className={styles.muted}>× {capacity[r]}</small>
                </span>
                <span className={factory.stockValue}>{percent(stats.utilization[r])}</span>
                <span className={factory.meter}>
                  <span style={{ width: percent(stats.utilization[r]) }} />
                </span>
              </li>
            ) : null,
          )}
        </ul>
        <p className={factory.note}>
          {number(stats.overtimeHours)} crew-hours of overtime so far, finishing trucks still on a door at close.
        </p>
      </section>

      <section className={factory.section} aria-label="Exceptions">
        <div className={factory.sectionHead}>
          <h2 className={factory.sectionTitle}>Exceptions</h2>
          <span className={factory.sectionNote}>
            {stats.damaged} damaged · {stats.rejected} failed QC · {stats.expedites} expedited
          </span>
        </div>
        {exceptions.length ? (
          <ul className={styles.rows}>
            {exceptions.map(({ hu, i, at }) => (
              <li key={i}>
                <button
                  type="button"
                  className={styles.row}
                  aria-pressed={selection?.kind === "hu" && selection.hu === i}
                  onClick={() => onSelect({ kind: "hu", hu: i })}
                >
                  <span className={styles.rowName}>
                    <span className={factory.code}>{huName(hu)}</span>
                    {MATERIALS[hu.material].label}
                  </span>
                  <span className={styles.phase} data-phase="hold">
                    {hu.outcome === DAMAGED ? "Damaged" : "Failed QC"} · {clockLabel(at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={factory.note}>No damage or QC failures yet.</p>
        )}
      </section>

      <section className={factory.section} aria-label="Next appointments">
        <div className={factory.sectionHead}>
          <h2 className={factory.sectionTitle}>Next appointments</h2>
          <span className={factory.sectionNote}>Booked, on the way</span>
        </div>
        {next.length ? (
          <ul className={styles.rows}>
            {next.map(({ tr, i }) => (
              <li key={i}>
                <button
                  type="button"
                  className={styles.row}
                  aria-pressed={selection?.kind === "truck" && selection.truck === i}
                  onClick={() => onSelect({ kind: "truck", truck: i })}
                >
                  <span className={styles.rowName}>
                    <span className={factory.code}>{truckName(tr)}</span>
                    {SUPPLIERS[tr.supplier].label}
                    {tr.expedite ? <span className={factory.tag}>Expedite</span> : null}
                  </span>
                  <span className={styles.phase} data-phase="enroute">
                    {clockLabel(tr.appointment)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={factory.note}>Nothing booked.</p>
        )}
      </section>
    </>
  );
}

function Meter({ label, value, of, high }: { label: string; value: number; of: number; high: number }): ReactElement {
  const share = of ? value / of : 0;
  return (
    <li className={factory.stockRow} data-low={share >= high ? "" : undefined}>
      <span className={factory.stockName}>{label}</span>
      <span className={factory.stockValue}>
        {value} <small>of {of}</small>
      </span>
      <span className={factory.meter}>
        <span style={{ width: percent(share) }} />
      </span>
    </li>
  );
}

function Details({
  trace,
  t,
  selection,
  onSelect,
}: {
  trace: InboundTrace;
  t: number;
  selection: NonNullable<DockSelection>;
  onSelect: (selection: DockSelection) => void;
}): ReactElement {
  const cfg = trace.config;
  const doors = planLayout(cfg).doors;
  const when = (at: number) => (at > t ? "–" : at < 0 ? "Before day 1" : clockLabel(at));
  let title: string;
  let body: ReactElement;

  if (selection.kind === "truck") {
    const tr = trace.trucks[selection.truck];
    const phase = truckPhase(tr, t);
    const late = tr.arrive - tr.appointment;
    const detained = detentionOf(tr, cfg, t);
    const lines = new Map<number, { hus: number; units: number; hu: string }>();
    for (const h of tr.hus) {
      const hu = trace.hus[h];
      const line = lines.get(hu.material) ?? {
        hus: 0,
        units: 0,
        hu: HANDLING[hu.handling].hu,
      };
      line.hus++;
      line.units += hu.units;
      lines.set(hu.material, line);
    }
    title = `${truckName(tr)} · ${SUPPLIERS[tr.supplier].label}`;
    body = (
      <>
        <dl className={factory.facts}>
          <Fact label="Now">
            <span className={styles.phase} data-phase={phase}>
              {TRUCK_PHASE_LABELS[phase]}
            </span>
          </Fact>
          <Fact label="Truck">
            {tr.kind === "van" ? "Dry van, dock-high door" : "Flatbed, drive-in bay"}
            {tr.door >= 0 && tr.docked <= t ? ` · ${doors[tr.door].name}` : ""}
            {tr.expedite ? " · expedited replacement" : ""}
          </Fact>
          <Fact label="Load">
            {[...lines]
              .map(([m, l]) => `${l.hus} × ${l.hu}, ${number(l.units)} ${MATERIALS[m].label.toLowerCase()}`)
              .join("; ")}
          </Fact>
          <Fact label="Slot">
            {clockLabel(tr.appointment)}
            {tr.arrive <= t
              ? ` · ${Math.abs(late) < 1 / 60 ? "on the dot" : `${duration(Math.abs(late))} ${late < 0 ? "early" : "late"}`}`
              : ""}
          </Fact>
          {detained > 0 ? (
            <Fact label="Detention">{`${number(detained)} h · $${number(Math.round(detained * cfg.detentionRate))}`}</Fact>
          ) : null}
          {phase === "gone" ? <Fact label="Turn">{duration(tr.departed - tr.arrive)} at the site</Fact> : null}
        </dl>
        <ol className={factory.history}>
          {(
            [
              ["PO placed", tr.ordered],
              ["At the gate", tr.arrive],
              ["Checked in", tr.gateIn],
              ["To the door", tr.docked],
              ["First HU off", tr.ready],
              ["Empty", tr.unloadEnd],
              ["BOL signed", tr.released],
              ["Out", tr.departed],
            ] as const
          ).map(([label, at], k, all) => (
            <li
              key={label}
              data-done={at <= t ? "" : undefined}
              data-active={at <= t && (k === all.length - 1 || all[k + 1][1] > t) && phase !== "gone" ? "" : undefined}
            >
              <span />
              <span>{label}</span>
              <span className={factory.historyTime}>{when(at)}</span>
            </li>
          ))}
        </ol>
        <ul className={styles.chips} aria-label="Handling units">
          {tr.hus.map((h) => {
            const hu = trace.hus[h];
            return (
              <li key={h}>
                <button
                  type="button"
                  className={styles.chip}
                  data-phase={huPhase(hu, t)}
                  onClick={() => onSelect({ kind: "hu", hu: h })}
                  title={`${huName(hu)} · ${MATERIALS[hu.material].label} · ${HU_PHASE_LABELS[huPhase(hu, t)]}`}
                >
                  {String(hu.id).slice(-3)}
                </button>
              </li>
            );
          })}
        </ul>
      </>
    );
  } else {
    const hu = trace.hus[selection.hu];
    const handling = HANDLING[hu.handling];
    const tr = trace.trucks[hu.truck];
    const phase = huPhase(hu, t);
    const zone = hu.outcome === STOCKED ? ZONE_LABELS[handling.zone] : "MRB cage";
    title = `${huName(hu)} · ${MATERIALS[hu.material].label}`;
    const steps: [string, number, number][] = [
      ["Off the truck", hu.unloadStart, hu.unloaded],
      ["Dock check", hu.unloaded, hu.checked],
      ["Receipt posted", hu.checked, hu.received],
    ];
    if (hu.inspect) steps.push([`QC · ${handling.inspect.test}`, hu.qcStart, hu.qcEnd]);
    steps.push([`Put away · ${zone}`, hu.putStart, hu.stored]);
    body = (
      <>
        <dl className={factory.facts}>
          <Fact label="Now">
            <span className={styles.phase} data-phase={phase}>
              {HU_PHASE_LABELS[phase]}
            </span>
          </Fact>
          <Fact label="Unit">{`${handling.hu} · ${number(hu.units)} units`}</Fact>
          <Fact label="Truck">
            <button type="button" className={styles.link} onClick={() => onSelect({ kind: "truck", truck: hu.truck })}>
              {truckName(tr)}
            </button>{" "}
            · {SUPPLIERS[tr.supplier].label}
          </Fact>
          <Fact label="Moved by">
            {handling.putawayWith === "crane" ? `Bay crane, ${cfg.craneCrew} crew` : "Forklift and handler"}
          </Fact>
          {hu.outcome !== STOCKED && (hu.outcome === DAMAGED ? hu.checked : hu.qcEnd) <= t ? (
            <Fact label="Outcome">
              {hu.outcome === DAMAGED
                ? "Damaged on arrival: red-tagged, OS&D on the BOL"
                : "Failed QC: red-tagged, SCAR to the supplier"}
              , replacement expedited
            </Fact>
          ) : null}
          {hu.stored <= t ? <Fact label="Dock to stock">{duration(hu.stored - hu.unloaded)}</Fact> : null}
        </dl>
        <ol className={factory.history}>
          {steps.map(([label, a, b]) => (
            <li key={label} data-done={b <= t ? "" : undefined} data-active={a <= t && t < b ? "" : undefined}>
              <span />
              <span>{label}</span>
              <span className={factory.historyTime}>{b <= t ? duration(b - a) : a <= t ? "now" : "–"}</span>
            </li>
          ))}
        </ol>
      </>
    );
  }

  return (
    <section className={factory.details} aria-label={title}>
      <div className={factory.detailsHead}>
        <h2 className={factory.detailsTitle}>{title}</h2>
        <button type="button" className={factory.close} onClick={() => onSelect(null)} aria-label="Close">
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
          </svg>
        </button>
      </div>
      {body}
    </section>
  );
}
