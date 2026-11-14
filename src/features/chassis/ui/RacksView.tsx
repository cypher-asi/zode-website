"use client";

import { useState, type ReactElement } from "react";
import { fmtN } from "../model/format";
import { SlotKind, type Slot } from "../model/schema";
import { useDesign } from "../store";
import styles from "../chassis.module.css";
import { EditField, num } from "./fields";

const TYPE_FIELDS = [
  ["Label", "label", "text"],
  ["kW cap", "kwCap", "number"],
  ["RDHx kW", "rdhxKw", "number"],
  ["Tap A", "tapAmps", "number"],
] as const;

/** The compute pod's row of racks in bay order, and each rack type's U elevation. */
export function RacksView(): ReactElement {
  const data = useDesign((s) => s.data);
  const d = useDesign((s) => s.derived);
  const selection = useDesign((s) => s.selection);
  const { select, edit } = useDesign.getState();
  const [typeId, setTypeId] = useState(data.racks.types[0]?.id ?? "");
  const type = data.racks.types.find((t) => t.id === typeId) ?? data.racks.types[0];
  const audit = d.uAudit.find((a) => a.typeId === type?.id);

  const moveRack = (i: number, by: -1 | 1) =>
    edit("racks", (r) => {
      const j = i + by;
      if (j < 0 || j >= r.racks.length) return;
      [r.racks[i], r.racks[j]] = [r.racks[j], r.racks[i]];
    });

  const addRack = () =>
    edit("racks", (r) => {
      const id = (n: number) => `C${String(n).padStart(2, "0")}`;
      let n = r.racks.length + 1;
      while (r.racks.some((x) => x.id === id(n))) n++;
      r.racks.push({ id: id(n), type: r.types[0].id, tap: `T${String(r.racks.length + 1).padStart(2, "0")}` });
    });

  const setSlot = (index: number, patch: Partial<Slot>) =>
    edit("racks", (r) => {
      const t = r.types.find((x) => x.id === type.id);
      if (t) t.slots[index] = { ...t.slots[index], ...patch };
    });

  const auditStatus = !audit
    ? "info"
    : audit.overlaps.length || audit.outOfRange.length
      ? "fail"
      : audit.free.length
        ? "warn"
        : "pass";

  return (
    <div className={styles.page}>
      <div className={styles.pageInner}>
        <div className={styles.pageHead}>
          <div>
            <h2 className={styles.pageTitle}>Racks &amp; elevations</h2>
            <p className={styles.pageText}>
              The row&apos;s bay order, rack types and their U elevations. G-101, G-105, G-106, G-107, E-101 and the
              BOM checks redraw from these.
            </p>
          </div>
        </div>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h3 className={styles.sectionTitle}>
              Row order<strong>{d.racks.length} bays</strong>
            </h3>
            <button type="button" className={styles.button} onClick={addRack}>
              Add rack
            </button>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: 48 }}>Bay</th>
                  <th style={{ width: 100 }}>Rack ID</th>
                  <th style={{ width: 200 }}>Type</th>
                  <th style={{ width: 88 }}>Tap</th>
                  <th className={styles.num} style={{ width: 72 }}>
                    kW cap
                  </th>
                  <th className={styles.num}>A / B bank kW</th>
                  <th className={styles.num} style={{ width: 96 }}>
                    x mm
                  </th>
                  <th style={{ width: 104 }} />
                </tr>
              </thead>
              <tbody>
                {data.racks.racks.map((r, i) => {
                  const placed = d.racks.find((x) => x.id === r.id);
                  const power = d.power.racks.find((x) => x.rack.id === r.id);
                  const key = `rack:${r.id}`;
                  return (
                    <tr key={`${r.id}-${i}`} onClick={() => select(key)} aria-selected={selection === key}>
                      <td className={styles.muted}>{i + 1}</td>
                      <td>
                        <EditField
                          value={r.id}
                          label="Rack ID"
                          onCommit={(v) =>
                            edit("racks", (f) => {
                              if (v && !f.racks.some((x) => x.id === v)) f.racks[i].id = v;
                            })
                          }
                        />
                      </td>
                      <td>
                        <select
                          className={styles.cell}
                          value={r.type}
                          aria-label={`Type of ${r.id}`}
                          onChange={(event) =>
                            edit("racks", (f) => {
                              f.racks[i].type = event.target.value;
                            })
                          }
                        >
                          {data.racks.types.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.id} ({t.label})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <EditField
                          value={r.tap}
                          label="Tap"
                          onCommit={(v) =>
                            edit("racks", (f) => {
                              f.racks[i].tap = v;
                            })
                          }
                        />
                      </td>
                      <td className={styles.num}>{placed?.kw ?? "–"}</td>
                      <td className={styles.num}>
                        {power?.banks.map((b) => (
                          <span key={b.bank} className={placed && b.kW < placed.kw ? styles.bad : undefined}>
                            {" "}
                            {b.bank} {fmtN(b.kW, 1)}
                          </span>
                        ))}
                      </td>
                      <td className={`${styles.num} ${styles.muted}`}>{placed ? fmtN(placed.x) : "–"}</td>
                      <td className={styles.num}>
                        <button
                          type="button"
                          className={styles.rowButton}
                          title="Move up the row"
                          onClick={(event) => {
                            event.stopPropagation();
                            moveRack(i, -1);
                          }}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className={styles.rowButton}
                          title="Move down the row"
                          onClick={(event) => {
                            event.stopPropagation();
                            moveRack(i, 1);
                          }}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className={styles.rowButton}
                          data-danger
                          title={`Remove rack ${r.id}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (window.confirm(`Remove rack ${r.id}?`)) {
                              edit("racks", (f) => {
                                f.racks.splice(i, 1);
                              });
                            }
                          }}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {type ? (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h3 className={styles.sectionTitle}>Rack type elevation</h3>
              <div className={styles.typeTabs}>
                {data.racks.types.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={styles.chip}
                    aria-pressed={t.id === type.id}
                    data-active={t.id === type.id ? "" : undefined}
                    onClick={() => setTypeId(t.id)}
                  >
                    {t.id}
                  </button>
                ))}
                {audit ? (
                  <span className={styles.badge} data-status={auditStatus}>
                    {audit.assigned} of {data.racks.bay.units}U assigned
                    {audit.overlaps.length ? ` · ${audit.overlaps.join("; ")}` : ""}
                    {audit.outOfRange.length ? ` · ${audit.outOfRange.join("; ")}` : ""}
                    {audit.free.length ? ` · free U${audit.free.join(", U")}` : ""}
                  </span>
                ) : null}
              </div>
            </div>
            <div className={styles.typeFields}>
              {TYPE_FIELDS.map(([label, field, kind]) => (
                <label key={field}>
                  <span>{label}</span>
                  <EditField
                    type={kind}
                    value={type[field]}
                    onCommit={(v) =>
                      edit("racks", (r) => {
                        const t = r.types.find((x) => x.id === type.id);
                        if (!t) return;
                        if (field === "label") t.label = v;
                        else t[field] = num(v) ?? t[field];
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.num} style={{ width: 80 }}>
                      U start
                    </th>
                    <th className={styles.num} style={{ width: 80 }}>
                      U height
                    </th>
                    <th style={{ width: 112 }}>Kind</th>
                    <th>Label</th>
                    <th style={{ width: 220 }}>Part</th>
                    <th style={{ width: 64 }}>Bank</th>
                    <th style={{ width: 32 }} />
                  </tr>
                </thead>
                <tbody>
                  {type.slots
                    .map((slot, index) => ({ slot, index }))
                    .sort((a, b) => b.slot.uStart - a.slot.uStart)
                    .map(({ slot, index }) => (
                      <tr
                        key={index}
                        onClick={() => slot.part && select(`part:${slot.part}`)}
                        aria-selected={slot.part ? selection === `part:${slot.part}` : undefined}
                      >
                        <td>
                          <EditField
                            type="number"
                            value={slot.uStart}
                            label="U start"
                            onCommit={(v) => setSlot(index, { uStart: num(v) ?? slot.uStart })}
                          />
                        </td>
                        <td>
                          <EditField
                            type="number"
                            value={slot.uHeight}
                            label="U height"
                            onCommit={(v) => setSlot(index, { uHeight: num(v) ?? slot.uHeight })}
                          />
                        </td>
                        <td>
                          <select
                            className={styles.cell}
                            value={slot.kind}
                            aria-label="Kind"
                            onChange={(event) => setSlot(index, { kind: event.target.value as Slot["kind"] })}
                          >
                            {SlotKind.options.map((k) => (
                              <option key={k}>{k}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <EditField value={slot.label} label="Label" onCommit={(v) => setSlot(index, { label: v })} />
                        </td>
                        <td>
                          <select
                            className={styles.cell}
                            value={slot.part ?? ""}
                            aria-label="Part"
                            onChange={(event) => setSlot(index, { part: event.target.value || null })}
                          >
                            <option value="">None</option>
                            {data.parts.parts.map((p) => (
                              <option key={p.partId} value={p.partId}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className={styles.cell}
                            value={slot.bank ?? ""}
                            aria-label="Bank"
                            onChange={(event) => setSlot(index, { bank: (event.target.value || null) as Slot["bank"] })}
                          >
                            <option value="">–</option>
                            <option>A</option>
                            <option>B</option>
                          </select>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={styles.rowButton}
                            data-danger
                            title="Remove slot"
                            onClick={(event) => {
                              event.stopPropagation();
                              edit("racks", (r) => {
                                r.types.find((x) => x.id === type.id)?.slots.splice(index, 1);
                              });
                            }}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              className={styles.addButton}
              onClick={() =>
                edit("racks", (r) => {
                  const t = r.types.find((x) => x.id === type.id);
                  if (!t) return;
                  const free = audit?.free[0] ?? data.racks.bay.units;
                  t.slots.push({ uStart: free, uHeight: 1, kind: "spare", part: null, label: "SPARE", bank: null });
                })
              }
            >
              Add slot
            </button>
          </section>
        ) : null}
      </div>
    </div>
  );
}
