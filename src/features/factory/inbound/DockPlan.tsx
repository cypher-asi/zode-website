"use client";

import { memo, useMemo, useSyncExternalStore, type MouseEvent, type ReactElement } from "react";
import { HANDLING, ZONE_LABELS, type InboundConfig, type StoreZone } from "../model/inbound";
import { STOCKED, type InboundTrace } from "../sim/inbound";
import { HU_PHASE_LABELS, TRUCK_PHASE_LABELS, huName, truckName } from "../sim/inboundStats";
import {
  LAY_SIZE,
  STAGE_SIZE,
  TRAILER,
  TRUCK_WIDTH,
  WALL,
  cranePositions,
  drawHus,
  drawTrucks,
  planLayout,
  rigLength,
  type PlanLayout,
} from "./plan";
import type { DockSelection } from "./selection";
import styles from "./inbound.module.css";

interface DockPlanProps {
  trace: InboundTrace;
  getTime: () => number;
  subscribe: (listener: (time: number) => void) => () => void;
  selection: DockSelection;
  onSelect: (selection: DockSelection) => void;
}

/**
 * The receiving dock from above, roughly to scale: the gate and yard
 * outside the dock wall, the doors and flatbed bay in it, and the floor
 * behind it. Trucks and HUs move with the playhead, every frame; click one
 * to select it.
 */
export function DockPlan({ trace, getTime, subscribe, selection, onSelect }: DockPlanProps): ReactElement {
  const t = useSyncExternalStore(subscribe, getTime, getTime);
  const plan = useMemo(() => planLayout(trace.config), [trace.config]);

  const trucks = drawTrucks(trace, plan, t);
  const hus = drawHus(trace, plan, t);
  const cranes = cranePositions(trace, plan, hus, t);
  const zones = { cage: 0, racking: 0, steel: 0, mrb: 0 };
  for (const hu of trace.hus) {
    if (hu.stored > t) continue;
    if (hu.outcome === STOCKED) zones[HANDLING[hu.handling].zone]++;
    else zones.mrb++;
  }
  const qc = hus.filter((h) => h.phase === "qc").length;
  const onSite = trucks.filter((d) => d.phase !== "gone").length;

  const pick = (e: MouseEvent<SVGSVGElement>) => {
    const el = (e.target as Element).closest("[data-truck],[data-hu]");
    if (!el) return onSelect(null);
    const truck = el.getAttribute("data-truck");
    const hu = el.getAttribute("data-hu");
    if (truck !== null) onSelect({ kind: "truck", truck: Number(truck) });
    else if (hu !== null) onSelect({ kind: "hu", hu: Number(hu) });
  };

  const selectedTruck = selection?.kind === "truck" ? selection.truck : -1;
  const selectedHu = selection?.kind === "hu" ? selection.hu : -1;
  const label = trucks.find((d) => d.index === selectedTruck);

  return (
    <svg
      className={styles.plan}
      viewBox={`0 -2 ${plan.width} ${plan.height + 2}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Receiving dock: ${onSite} trucks on site, ${hus.length} HUs on the floor or moving, ${qc} in QC.`}
      onClick={pick}
    >
      <Ground plan={plan} config={trace.config} />
      <Zone rect={plan.qc} title="QC bench" count={`${qc} in QC`} />
      <Zone rect={plan.mrb} title="MRB cage" count={`${zones.mrb} held`} tone="danger" />
      {(Object.keys(ZONE_LABELS) as StoreZone[]).map((z) => (
        <Zone key={z} rect={plan.zones[z]} title={ZONE_LABELS[z]} count={`${zones[z]} HUs in`} />
      ))}

      {/* Cranes: the bridge over each bay and its laydown, at its trolley. */}
      {plan.bays.map((b, i) => (
        <line key={i} x1={cranes[i]} x2={cranes[i]} y1={b.y + 0.3} y2={b.y + b.h - 0.3} className={styles.crane} />
      ))}

      {trucks.map((d) => {
        const len = TRAILER[d.kind];
        const rig = rigLength(d.kind);
        const half = TRUCK_WIDTH / 2;
        return (
          <g
            key={d.index}
            data-truck={d.index}
            className={styles.truck}
            data-phase={d.phase}
            data-detained={d.detained || undefined}
            data-selected={d.index === selectedTruck || undefined}
            transform={`translate(${d.pose.x.toFixed(2)} ${d.pose.y.toFixed(2)}) rotate(${d.pose.heading.toFixed(1)})`}
          >
            <rect
              x={-rig}
              y={-half}
              width={len}
              height={TRUCK_WIDTH}
              className={d.kind === "van" ? styles.van : styles.deck}
            />
            <rect
              x={-rig + len + 0.4}
              y={-half + 0.15}
              width={rig - len - 0.4}
              height={TRUCK_WIDTH - 0.3}
              className={styles.cab}
            />
            {d.kind === "flatbed"
              ? Array.from({ length: Math.min(d.aboard, 4) }, (_, k) => (
                  <rect
                    key={k}
                    x={-rig + 0.4 + k * 3.5}
                    y={-half + 0.4}
                    width={3.1}
                    height={TRUCK_WIDTH - 0.8}
                    className={styles.load}
                  />
                ))
              : null}
          </g>
        );
      })}
      {label ? (
        <text
          x={label.pose.x + (Math.cos((label.pose.heading * Math.PI) / 180) < -0.5 ? -1.2 : 1.2)}
          y={label.pose.y + 0.6}
          textAnchor={Math.cos((label.pose.heading * Math.PI) / 180) < -0.5 ? "end" : "start"}
          className={styles.truckLabel}
        >
          {truckName(trace.trucks[label.index])} · {TRUCK_PHASE_LABELS[label.phase]}
        </text>
      ) : null}

      {hus.map((h) => {
        const [w, hgt] = h.area === 0 ? [STAGE_SIZE - 0.5, STAGE_SIZE - 0.5] : [LAY_SIZE[0] - 0.8, LAY_SIZE[1] - 0.8];
        return (
          <rect
            key={h.index}
            data-hu={h.index}
            x={h.x - w / 2}
            y={h.y - hgt / 2}
            width={w}
            height={hgt}
            rx={0.3}
            className={styles.hu}
            data-phase={h.phase}
            data-selected={h.index === selectedHu || undefined}
          >
            <title>{`${huName(trace.hus[h.index])} · ${HU_PHASE_LABELS[h.phase]}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

/** What doesn't move: the site, the building, its doors, bays and floor areas. */
const Ground = memo(function Ground({ plan, config }: { plan: PlanLayout; config: InboundConfig }): ReactElement {
  return (
    <>
      {/* Site: yard, road and gate. */}
      <g className={styles.site}>
        <line x1={-40} x2={WALL} y1={plan.roadY} y2={plan.roadY} className={styles.road} />
        {plan.stalls.map((s, i) => (
          <rect key={i} x={s.x} y={s.y} width={TRUCK_WIDTH} height={rigLength("van")} className={styles.stall} />
        ))}
        <rect x={plan.gateX + 1.5} y={plan.roadY - 7} width={4} height={3.5} className={styles.shack} />
        <line
          x1={plan.gateX + 1}
          x2={plan.gateX + 1}
          y1={plan.roadY - 3.4}
          y2={plan.roadY + 3.4}
          className={styles.gate}
        />
        <text x={plan.gateX + 6.5} y={plan.roadY - 4.6} className={styles.zoneLabel}>
          Gate
        </text>
        <text x={plan.stalls[0]?.x ?? 4} y={plan.yardTop - 1.4} className={styles.zoneLabel}>
          Yard · {plan.stalls.length} stalls
        </text>
      </g>

      {/* The building, its doors and the receiving floor. */}
      <rect
        x={plan.building.x}
        y={plan.building.y}
        width={plan.building.w}
        height={plan.building.h}
        className={styles.building}
      />
      {plan.doors.map((d) => (
        <g key={d.name}>
          <line
            x1={WALL}
            x2={WALL}
            y1={d.y - (d.kind === "van" ? 1.6 : 2.6)}
            y2={d.y + (d.kind === "van" ? 1.6 : 2.6)}
            className={styles.door}
          />
          <text x={WALL - 1} y={d.y - 2} textAnchor="end" className={styles.doorLabel}>
            {d.name}
          </text>
        </g>
      ))}
      {plan.bays.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} className={styles.bay} />
          <text x={b.x + 1} y={b.y + 1.9} className={styles.zoneLabel}>
            Flatbed bay {i + 1}
          </text>
        </g>
      ))}
      <rect {...box(plan.stage)} className={styles.area} />
      <text x={plan.stage.x} y={plan.stage.y - 0.6} className={styles.zoneLabel}>
        Dock staging · {config.dockStaging}
      </text>
      {plan.staging.map((s, i) => (
        <rect key={i} x={s.x} y={s.y} width={STAGE_SIZE} height={STAGE_SIZE} className={styles.slot} />
      ))}
      <rect {...box(plan.laydownArea)} className={styles.area} />
      <text x={plan.laydownArea.x} y={plan.laydownArea.y + plan.laydownArea.h + 2} className={styles.zoneLabel}>
        Bay laydown · {config.bayLaydown}
      </text>
      {plan.laydown.map((s, i) => (
        <rect key={i} x={s.x} y={s.y} width={LAY_SIZE[0]} height={LAY_SIZE[1]} className={styles.slot} />
      ))}
    </>
  );
});

const box = (r: { x: number; y: number; w: number; h: number }) => ({
  x: r.x,
  y: r.y,
  width: r.w,
  height: r.h,
});

function Zone({
  rect,
  title,
  count,
  tone,
}: {
  rect: { x: number; y: number; w: number; h: number };
  title: string;
  count: string;
  tone?: "danger";
}): ReactElement {
  return (
    <g>
      <rect {...box(rect)} className={styles.zone} data-tone={tone} />
      <text x={rect.x + 1} y={rect.y + 2.2} className={styles.zoneLabel}>
        {title}
      </text>
      <text x={rect.x + 1} y={rect.y + 4.6} className={styles.zoneCount}>
        {count}
      </text>
    </g>
  );
}
