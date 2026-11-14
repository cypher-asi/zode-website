"use client";

import { useState, type ReactElement } from "react";
import { dimsText, usd } from "../model/format";
import { PartCategory, type Part } from "../model/schema";
import { useDesign } from "../store";
import { webHref } from "../types";
import styles from "../chassis.module.css";
import { EditField, num } from "./fields";

/** The parts catalog: dimensions size the drawn geometry, costs price the BOM lines that use them. */
export function PartsView(): ReactElement {
  const parts = useDesign((s) => s.data.parts.parts);
  const d = useDesign((s) => s.derived);
  const selection = useDesign((s) => s.selection);
  const { select, updatePart, edit } = useDesign.getState();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Part["category"] | "all">("all");

  const filter = query.trim().toLowerCase();
  const rows = parts.filter(
    (p) =>
      (category === "all" || p.category === category) &&
      (!filter || [p.partId, p.name, p.manufacturer, p.sku, p.notes].some((s) => s?.toLowerCase().includes(filter))),
  );

  const addPart = () => {
    let n = 1;
    while (d.partsById.has(`new-part-${n}`)) n++;
    const partId = `new-part-${n}`;
    edit("parts", (p) => {
      p.parts.push({
        partId,
        name: "New part",
        category: category === "all" ? "service" : category,
        manufacturer: null,
        sku: null,
        productUrl: null,
        dims: null,
        rackUnits: null,
        ratings: {},
        unitCost: null,
        costBasis: "A",
        supply: "bom",
        coveredBy: null,
        notes: "",
      });
    });
    select(`part:${partId}`);
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageInner}>
        <div className={styles.pageHead}>
          <div>
            <h2 className={styles.pageTitle}>Parts catalog</h2>
            <p className={styles.pageText}>
              {parts.length} parts. Dimensions here size the drawn geometry; costs flow into the BOM unless a line
              overrides them.
            </p>
          </div>
          <div className={styles.pageTools}>
            <select
              className={styles.select}
              value={category}
              onChange={(event) => setCategory(event.target.value as typeof category)}
              aria-label="Category"
            >
              <option value="all">All categories</option>
              {PartCategory.options.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input
              className={styles.search}
              placeholder="Filter by name, SKU, maker…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Filter parts"
            />
            <button type="button" className={styles.buttonPrimary} onClick={addPart}>
              Add part
            </button>
          </div>
        </div>

        <div className={`${styles.tableWrap} ${styles.section}`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th style={{ width: 80 }}>Category</th>
                <th style={{ width: 140 }}>Manufacturer</th>
                <th style={{ width: 140 }}>SKU</th>
                <th style={{ width: 150 }}>W × D × H mm</th>
                <th className={styles.num} style={{ width: 40 }}>
                  U
                </th>
                <th className={styles.num} style={{ width: 112 }}>
                  Unit cost
                </th>
                <th style={{ width: 32 }} title="Cost basis">
                  B
                </th>
                <th style={{ width: 110 }}>BOM</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const key = `part:${p.partId}`;
                const boms = d.bomByPart.get(p.partId) ?? [];
                const product = webHref(p.productUrl);
                return (
                  <tr key={p.partId} onClick={() => select(key)} aria-selected={selection === key}>
                    <td>
                      <EditField value={p.name} onCommit={(v) => updatePart(p.partId, { name: v })} label="Name" />
                      <div className={styles.sub}>{p.partId}</div>
                    </td>
                    <td className={styles.muted}>{p.category}</td>
                    <td>
                      <EditField
                        value={p.manufacturer}
                        placeholder="–"
                        onCommit={(v) => updatePart(p.partId, { manufacturer: v || null })}
                        label="Manufacturer"
                      />
                    </td>
                    <td>
                      <EditField
                        value={p.sku}
                        placeholder="–"
                        onCommit={(v) => updatePart(p.partId, { sku: v || null })}
                        label="SKU"
                      />
                      {product ? (
                        <a
                          className={styles.link}
                          href={product}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                        >
                          product page ↗
                        </a>
                      ) : null}
                    </td>
                    <td className={styles.num}>{p.dims ? dimsText(p.dims) : "–"}</td>
                    <td className={styles.num}>{p.rackUnits ?? "–"}</td>
                    <td>
                      {p.supply === "bom" ? (
                        <EditField
                          type="number"
                          value={p.unitCost}
                          placeholder="–"
                          onCommit={(v) => updatePart(p.partId, { unitCost: num(v) })}
                          label="Unit cost"
                        />
                      ) : (
                        <span className={`${styles.num} ${styles.muted}`}>
                          {p.supply === "tenant" ? "tenant" : `in ${p.coveredBy}`}
                        </span>
                      )}
                    </td>
                    <td className={styles.muted}>{p.costBasis ?? ""}</td>
                    <td>
                      <div className={styles.chips}>
                        {boms.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            className={styles.chip}
                            title={`${b.qty} × ${usd(d.bom.lines.find((l) => l.id === b.id)?.unitCost)}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              select(`bom:${b.id}`);
                            }}
                          >
                            {b.id}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
