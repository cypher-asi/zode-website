"use client";

import { useId, useState, type ReactElement } from "react";
import { bandwidth, capacityTb, count, exaflops, power } from "./format";
import { LAYER_LABELS } from "./model/catalog";
import type { ClusterModel, Layer } from "./model/types";
import styles from "./StatsBar.module.css";

const GROUPS: readonly Layer[] = ["compute", "network", "storage", "management", "rack"];

/** The cluster's headline figures along the foot of the viewport, opening onto the full parts list. */
export function StatsBar({ model }: { model: ClusterModel }): ReactElement {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const s = model.stats;
  const stats = [
    { label: "GPUs", value: count(s.gpus) },
    { label: "Nodes", value: count(s.nodes) },
    { label: "Racks", value: count(s.racks) },
    { label: "IT power", value: power(s.itKw) },
    { label: "GPU memory", value: capacityTb(s.gpuMemoryTb) },
    { label: "FP4 compute", value: exaflops(s.fp4Exaflops) },
    { label: "Fabric", value: bandwidth(s.fabricTbps) },
    { label: "Fiber", value: `${s.fiberKm.toFixed(1)} km` },
  ];

  return (
    <div className={styles.dock}>
      {open ? (
        <div id={listId} className={styles.parts} role="region" aria-label="Parts list">
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Part</th>
                <th scope="col">Model</th>
                <th scope="col" className={styles.qty}>
                  Qty
                </th>
              </tr>
            </thead>
            {GROUPS.map((layer) => {
              const rows = model.parts.filter((p) => p.layer === layer);
              if (!rows.length) return null;
              return (
                <tbody key={layer}>
                  <tr className={styles.group}>
                    <th scope="rowgroup" colSpan={3}>
                      {LAYER_LABELS[layer]}
                    </th>
                  </tr>
                  {rows.map((p) => (
                    <tr key={p.label}>
                      <th scope="row">{p.label}</th>
                      <td>
                        {p.model}
                        {p.detail ? <span className={styles.detail}>{p.detail}</span> : null}
                      </td>
                      <td className={styles.qty}>{count(p.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              );
            })}
          </table>
          <p className={styles.fineprint}>
            Planning figures from placeholder specs, not a quote. Floor area about {Math.round(s.footprintM2)} m².
          </p>
        </div>
      ) : null}
      <div className={styles.bar}>
        <dl className={styles.stats}>
          {stats.map((stat) => (
            <div key={stat.label} className={styles.stat}>
              <dt className={styles.label}>{stat.label}</dt>
              <dd className={styles.value}>{stat.value}</dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((o) => !o)}
        >
          Parts list
          <svg viewBox="0 0 10 6" aria-hidden="true">
            <path d={open ? "M1 1l4 4 4-4" : "M1 5l4-4 4 4"} />
          </svg>
        </button>
      </div>
    </div>
  );
}
