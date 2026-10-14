"use client";

import type { ReactElement } from "react";
import { MATERIALS, type Scenario } from "../model/catalog";
import { HANDLING, SUPPLIERS, ZONE_LABELS, supplierIndex } from "../model/inbound";
import { dockLoad, inboundSteps, receivingBuildOut } from "../model/inboundProcess";
import { number, percent } from "../format";
import factory from "../factory.module.css";
import styles from "./inbound.module.css";

/**
 * Receiving as it would be run: the week's load against the crew and doors
 * on hand, each step from the purchase order to the shelf, what arrives in
 * what, and what the dock needs built and bought.
 */
export function ProcessPanel({ scenario }: { scenario: Scenario }): ReactElement {
  const cfg = scenario.inbound;
  const load = dockLoad(scenario);
  const steps = inboundSteps(cfg);
  const buildOut = receivingBuildOut(cfg);

  return (
    <>
      <p className={factory.note}>
        At a pod every {number(scenario.releaseEveryHours)} h, the dock takes about{" "}
        <strong>{number(load.trucks.van)} vans</strong> and <strong>{number(load.trucks.flatbed)} flatbeds</strong> a
        week, {number(Math.round(load.hus))} handling units for {number(load.podsPerWeek)} pods.
      </p>

      <section className={factory.section} aria-label="Weekly load">
        <div className={factory.sectionHead}>
          <h2 className={factory.sectionTitle}>Weekly load</h2>
          <span className={factory.sectionNote}>Hours needed of hours open</span>
        </div>
        <ul className={factory.stock}>
          {load.rows.map((r) => {
            const share = r.have ? r.need / r.have : r.need ? 1 : 0;
            return (
              <li key={r.id} className={factory.stockRow} data-low={share > 0.85 ? "" : undefined}>
                <span className={factory.stockName}>{r.label}</span>
                <span className={factory.stockValue}>
                  {percent(share)}{" "}
                  <small>
                    · {number(Math.round(r.need))} of {number(r.have)} h
                  </small>
                </span>
                <span className={factory.meter}>
                  <span style={{ width: percent(Math.min(1, share)) }} />
                </span>
              </li>
            );
          })}
        </ul>
        <p className={factory.note}>
          Averages. Trucks bunch on appointment days, so the dock wants headroom above them.
        </p>
      </section>

      <section className={factory.section} aria-label="Steps">
        <div className={factory.sectionHead}>
          <h2 className={factory.sectionTitle}>The process</h2>
          <span className={factory.sectionNote}>{steps.length} steps, PO to shelf</span>
        </div>
        <ol className={styles.steps}>
          {steps.map((s, i) => (
            <li key={s.id}>
              <details className={styles.step}>
                <summary>
                  <span className={styles.stepNumber}>{String(i + 1).padStart(2, "0")}</span>
                  <span className={styles.stepTitle}>{s.title}</span>
                  <span className={styles.stepTime}>{s.time}</span>
                </summary>
                <dl className={factory.facts}>
                  <Pair label="Where">{s.where}</Pair>
                  <Pair label="Who">{s.who}</Pair>
                  <Pair label="Kit">{s.equipment}</Pair>
                </dl>
                <List title="Does" items={s.does} />
                <List title="Rules" items={s.rules} />
                <List title="When it goes wrong" items={s.exceptions} />
                <List title="Records" items={s.records} />
              </details>
            </li>
          ))}
        </ol>
      </section>

      <section className={factory.section} aria-label="What arrives">
        <div className={factory.sectionHead}>
          <h2 className={factory.sectionTitle}>What arrives</h2>
          <span className={factory.sectionNote}>Per material</span>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Material</th>
                <th scope="col">Comes as</th>
                <th scope="col">Per truck</th>
                <th scope="col">QC</th>
                <th scope="col">Goes to</th>
              </tr>
            </thead>
            <tbody>
              {HANDLING.map((h) => {
                const s = SUPPLIERS[supplierIndex(h.supplier)];
                return (
                  <tr key={h.material}>
                    <th scope="row">
                      {label(h.material)}
                      <small>
                        {s.label}, {s.truck === "van" ? "van" : "flatbed"}
                      </small>
                    </th>
                    <td>{h.hu}</td>
                    <td>{h.perTruck}</td>
                    <td title={h.inspect.test}>{percent(h.inspect.share)}</td>
                    <td>{ZONE_LABELS[h.zone]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className={factory.section} aria-label="Build-out">
        <div className={factory.sectionHead}>
          <h2 className={factory.sectionTitle}>Build-out</h2>
          <span className={factory.sectionNote}>To build and buy</span>
        </div>
        {buildOut.map((g) => (
          <div key={g.title} className={styles.group}>
            <h3 className={styles.groupTitle}>{g.title}</h3>
            <dl className={factory.facts}>
              {g.items.map((it) => (
                <Pair key={it.item} label={it.item}>
                  {it.spec}
                </Pair>
              ))}
            </dl>
          </div>
        ))}
      </section>
    </>
  );
}

const label = (id: string) => MATERIALS.find((m) => m.id === id)?.label ?? id;

function Pair({ label, children }: { label: string; children: string }): ReactElement {
  return (
    <div className={styles.pair}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }): ReactElement | null {
  if (!items.length) return null;
  return (
    <div className={styles.list}>
      <h4>{title}</h4>
      <ul>
        {items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
