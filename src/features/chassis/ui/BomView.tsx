"use client";

import { useState, type ReactElement } from "react";
import { usd } from "../model/format";
import type { BomArea } from "../model/schema";
import { useDesign } from "../store";
import styles from "../chassis.module.css";
import { EditField, num } from "./fields";

/** The design's BOM by area, every line editable; its quantities and costs drive every sheet. */
export function BomView(): ReactElement {
  const data = useDesign((s) => s.data);
  const d = useDesign((s) => s.derived);
  const selection = useDesign((s) => s.selection);
  const { select, updateBom, edit } = useDesign.getState();
  const [query, setQuery] = useState("");

  const filter = query.trim().toLowerCase();
  const lines = d.bom.lines.filter(
    (l) =>
      !filter ||
      [l.id, l.partId, l.scope, l.group, l.part?.name, l.part?.manufacturer, l.part?.sku].some((s) =>
        s?.toLowerCase().includes(filter),
      ),
  );

  const addLine = (area: BomArea) => {
    const prefix = `${area.slice(0, 1).toUpperCase()}N`;
    let n = 1;
    while (d.bomById.has(`${prefix}${n}`)) n++;
    const id = `${prefix}${n}`;
    const partId = data.parts.parts[0]?.partId ?? "";
    edit("bom", (b) => {
      b.items.push({ id, area, group: "NEW", partId, qty: 1, scope: "New line item", unitCostOverride: null });
    });
    select(`bom:${id}`);
  };

  const removeLine = (id: string) => {
    if (!window.confirm(`Delete BOM line ${id}?`)) return;
    edit("bom", (b) => {
      b.items = b.items.filter((x) => x.id !== id);
    });
    if (selection === `bom:${id}`) select(null);
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageInner}>
        <div className={styles.pageHead}>
          <div>
            <h2 className={styles.pageTitle}>Bill of materials</h2>
            <p className={styles.pageText}>
              {d.bom.lines.length} lines, {d.bom.uniqueIds} unique IDs, total{" "}
              <span className={styles.strong}>{usd(d.bom.total)}</span>. Placed is how many the drawings place; a
              line that doesn&apos;t match is flagged. Send the design to a deployment to price it there.
            </p>
          </div>
          <input
            className={styles.search}
            placeholder="Filter by ID, part, SKU, scope…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Filter BOM lines"
          />
        </div>

        {data.bom.areas.map((area) => {
          const rows = lines.filter((l) => l.area === area.id);
          return (
            <section key={area.id} className={styles.section}>
              <div className={styles.sectionHead}>
                <h3 className={styles.sectionTitle}>
                  {area.label}
                  <strong>{usd(d.bom.areaTotals[area.id])}</strong>
                </h3>
                <button type="button" className={styles.button} onClick={() => addLine(area.id)}>
                  Add line
                </button>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ width: 56 }}>ID</th>
                      <th style={{ width: 220 }}>Part</th>
                      <th>Scope</th>
                      <th className={styles.num} style={{ width: 72 }}>
                        Qty
                      </th>
                      <th className={styles.num} style={{ width: 64 }}>
                        Placed
                      </th>
                      <th style={{ width: 32 }} title="Cost basis">
                        B
                      </th>
                      <th className={styles.num} style={{ width: 112 }}>
                        Unit override
                      </th>
                      <th className={styles.num} style={{ width: 96 }}>
                        Unit
                      </th>
                      <th className={styles.num} style={{ width: 112 }}>
                        Extended
                      </th>
                      <th style={{ width: 32 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((l) => {
                      const placed = d.placed.get(l.partId);
                      const mismatch = placed != null && placed !== l.qty;
                      const key = `bom:${l.id}`;
                      return (
                        <tr key={l.id} onClick={() => select(key)} aria-selected={selection === key}>
                          <td className={`${styles.mono} ${styles.strong}`}>{l.id}</td>
                          <td>
                            <select
                              className={styles.cell}
                              value={l.partId}
                              onChange={(event) => updateBom(l.id, { partId: event.target.value })}
                              aria-label={`Part for ${l.id}`}
                            >
                              {!l.part ? <option value={l.partId}>{l.partId} (missing)</option> : null}
                              {data.parts.parts.map((p) => (
                                <option key={p.partId} value={p.partId}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <EditField
                              value={l.scope}
                              onCommit={(v) => updateBom(l.id, { scope: v })}
                              label={`Scope of ${l.id}`}
                            />
                          </td>
                          <td>
                            <EditField
                              type="number"
                              value={l.qty}
                              onCommit={(v) => updateBom(l.id, { qty: num(v) ?? 0 })}
                              label={`Quantity of ${l.id}`}
                            />
                          </td>
                          <td className={`${styles.num} ${mismatch ? styles.bad : styles.muted}`}>{placed ?? "–"}</td>
                          <td className={styles.muted}>{l.basis}</td>
                          <td>
                            <EditField
                              type="number"
                              value={l.unitCostOverride}
                              placeholder="catalog"
                              onCommit={(v) => updateBom(l.id, { unitCostOverride: num(v) })}
                              label={`Unit cost override for ${l.id}`}
                            />
                          </td>
                          <td className={styles.num}>{usd(l.unitCost)}</td>
                          <td className={`${styles.num} ${styles.strong}`}>{usd(l.total)}</td>
                          <td>
                            <button
                              type="button"
                              className={styles.rowButton}
                              data-danger
                              title={`Delete line ${l.id}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                removeLine(l.id);
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
          );
        })}
        <p className={styles.note}>{data.bom.basisNote}</p>
      </div>
    </div>
  );
}
