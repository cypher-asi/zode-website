"use client";

import Link from "next/link";
import type { ReactElement } from "react";
import { uRange } from "../model/calc";
import { fmtN, usd } from "../model/format";
import { parseKey } from "../model/refs";
import { CostBasis, PartCategory, type Part } from "../model/schema";
import { whereUsed } from "../model/whereUsed";
import { useDesign } from "../store";
import { sheetHref, webHref } from "../types";
import styles from "../chassis.module.css";
import { EditField, num, Panel, Row } from "./fields";

const BASIS_LABEL: Record<CostBasis, string> = { A: "unquoted allowance", P: "supplier listing", U: "user-set" };

function skuSearchUrl(part: Part): string | null {
  const q = [part.manufacturer, part.sku].filter(Boolean).join(" ");
  return q ? `https://www.google.com/search?q=${encodeURIComponent(q)}` : null;
}

function PartEditor({ part }: { part: Part }): ReactElement {
  const updatePart = useDesign((s) => s.updatePart);
  const set = (patch: Partial<Part>) => updatePart(part.partId, patch);
  const product = webHref(part.productUrl);
  const search = skuSearchUrl(part);
  const dims = part.dims ?? { w: null, d: null, h: null };

  return (
    <Panel
      title="Part"
      right={
        <span className={styles.badge} data-status={part.supply === "bom" ? "dark" : "info"}>
          {part.supply === "component" ? `in ${part.coveredBy}` : part.supply}
        </span>
      }
    >
      <div className={styles.sub}>{part.partId}</div>
      <Row label="Name">
        <EditField value={part.name} onCommit={(v) => set({ name: v })} />
      </Row>
      <Row label="Category">
        <select
          className={styles.cell}
          value={part.category}
          onChange={(e) => set({ category: e.target.value as Part["category"] })}
        >
          {PartCategory.options.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </Row>
      <Row label="Manufacturer">
        <EditField value={part.manufacturer} placeholder="-" onCommit={(v) => set({ manufacturer: v || null })} />
      </Row>
      <Row label="SKU">
        <EditField value={part.sku} placeholder="-" onCommit={(v) => set({ sku: v || null })} />
      </Row>
      <Row label="Product URL">
        <EditField
          type="url"
          value={part.productUrl}
          placeholder="https://"
          onCommit={(v) => set({ productUrl: v || null })}
        />
      </Row>
      {product || search ? (
        <Row label="">
          <a className={styles.link} href={product ?? search!} target="_blank" rel="noreferrer">
            {product ? "Open product page ↗" : "Search for this SKU ↗"}
          </a>
        </Row>
      ) : null}
      <Row label="W × D × H mm">
        <span className={styles.triple}>
          {(["w", "d", "h"] as const).map((k) => (
            <EditField
              key={k}
              type="number"
              value={dims[k]}
              placeholder={k.toUpperCase()}
              label={k.toUpperCase()}
              onCommit={(v) => set({ dims: { ...dims, [k]: num(v) } })}
            />
          ))}
        </span>
      </Row>
      <Row label="Rack units">
        <EditField type="number" value={part.rackUnits} placeholder="-" onCommit={(v) => set({ rackUnits: num(v) })} />
      </Row>
      {part.supply !== "tenant" ? (
        <>
          <Row label="Unit cost USD">
            <EditField type="number" value={part.unitCost} placeholder="-" onCommit={(v) => set({ unitCost: num(v) })} />
          </Row>
          <Row label="Cost basis">
            <select
              className={styles.cell}
              value={part.costBasis ?? ""}
              onChange={(e) => set({ costBasis: (e.target.value || null) as Part["costBasis"] })}
            >
              <option value="">-</option>
              {CostBasis.options.map((c) => (
                <option key={c} value={c}>
                  {c}: {BASIS_LABEL[c]}
                </option>
              ))}
            </select>
          </Row>
        </>
      ) : null}
      {Object.entries(part.ratings).map(([k, v]) => (
        <Row key={k} label={k}>
          <EditField
            type={typeof v === "number" ? "number" : "text"}
            value={v}
            onCommit={(nv) => set({ ratings: { ...part.ratings, [k]: typeof v === "number" ? (num(nv) ?? 0) : nv } })}
          />
        </Row>
      ))}
      <Row label="Notes">
        <EditField value={part.notes} placeholder="-" onCommit={(v) => set({ notes: v })} />
      </Row>
    </Panel>
  );
}

function BomLineEditor({ id }: { id: string }): ReactElement | null {
  const line = useDesign((s) => s.derived.bom.lines.find((l) => l.id === id));
  const placed = useDesign((s) => (line ? s.derived.placed.get(line.partId) : undefined));
  const updateBom = useDesign((s) => s.updateBom);
  const areas = useDesign((s) => s.data.bom.areas);
  if (!line) return null;
  return (
    <Panel title={`BOM line ${line.id}`} right={<span className={styles.strong}>{usd(line.total)}</span>}>
      <div className={styles.small}>
        {areas.find((a) => a.id === line.area)?.label} · {line.group}
      </div>
      <Row label="Scope">
        <EditField value={line.scope} onCommit={(v) => updateBom(id, { scope: v })} />
      </Row>
      <Row label="Group">
        <EditField value={line.group} onCommit={(v) => updateBom(id, { group: v })} />
      </Row>
      <Row label="Qty">
        <span className={styles.inline}>
          <EditField type="number" value={line.qty} onCommit={(v) => updateBom(id, { qty: num(v) ?? 0 })} />
          {placed != null ? (
            <span className={placed === line.qty ? styles.small : styles.bad}>model: {placed}</span>
          ) : null}
          {placed != null && placed !== line.qty ? (
            <button type="button" className={styles.chip} onClick={() => updateBom(id, { qty: placed })}>
              Sync
            </button>
          ) : null}
        </span>
      </Row>
      <Row label="Unit override">
        <EditField
          type="number"
          value={line.unitCostOverride}
          placeholder={line.part?.unitCost != null ? `part: ${usd(line.part.unitCost)}` : "-"}
          onCommit={(v) => updateBom(id, { unitCostOverride: num(v) })}
        />
      </Row>
      <div className={styles.small}>
        {line.qty} × {usd(line.unitCost)} · basis {line.basis}
      </div>
    </Panel>
  );
}

function RackEditor({ id }: { id: string }): ReactElement {
  const data = useDesign((s) => s.data);
  const d = useDesign((s) => s.derived);
  const edit = useDesign((s) => s.edit);
  const select = useDesign((s) => s.select);
  const rack = d.racks.find((r) => r.id === id);
  const power = d.power.racks.find((r) => r.rack.id === id);
  if (!rack) return <div className={styles.inspectorEmpty}>Rack {id} isn&apos;t in the row any more.</div>;
  const editType = (recipe: (t: (typeof data.racks.types)[number]) => void) =>
    edit("racks", (r) => {
      const t = r.types.find((x) => x.id === rack.type.id);
      if (t) recipe(t);
    });
  return (
    <>
      <Panel title={`Rack ${rack.id}`} right={<span className={styles.strong}>{rack.kw} kW</span>}>
        <Row label="Bay">
          {rack.index + 1} of {d.racks.length} · x = {fmtN(rack.x)} mm
        </Row>
        <Row label="Type">
          <select
            className={styles.cell}
            value={rack.type.id}
            onChange={(e) =>
              edit("racks", (r) => {
                const x = r.racks.find((x) => x.id === id);
                if (x) x.type = e.target.value;
              })
            }
          >
            {data.racks.types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id} ({t.label}, {t.kwCap} kW)
              </option>
            ))}
          </select>
        </Row>
        <Row label="Tap">
          <EditField
            value={rack.tap}
            onCommit={(v) =>
              edit("racks", (r) => {
                const x = r.racks.find((x) => x.id === id);
                if (x) x.tap = v;
              })
            }
          />
        </Row>
        <Row label="Type kW cap">
          <EditField
            type="number"
            value={rack.type.kwCap}
            onCommit={(v) => editType((t) => (t.kwCap = num(v) ?? t.kwCap))}
          />
        </Row>
        <Row label="RDHx kW">
          <EditField
            type="number"
            value={rack.type.rdhxKw}
            onCommit={(v) => editType((t) => (t.rdhxKw = num(v) ?? t.rdhxKw))}
          />
        </Row>
        <p className={styles.small}>Type fields apply to every rack of type {rack.type.id}.</p>
      </Panel>
      {power ? (
        <Panel title="Power banks">
          {power.banks.map((b) => (
            <div key={b.bank} className={styles.row}>
              <span className={styles.rowLabel}>{b.bank} bank</span>
              <span className={b.kW >= rack.kw ? undefined : styles.bad}>
                {b.breakers.map((a) => `${a} A`).join(" + ")} · {fmtN(b.kVA, 1)} kVA / {fmtN(b.kW, 1)} kW
              </span>
            </div>
          ))}
          <div className={styles.small}>
            Tap {rack.tap}: {power.tapAmps} A each
          </div>
        </Panel>
      ) : null}
      <Panel title="Elevation, top to bottom">
        {[...rack.type.slots].reverse().map((s) => (
          <button
            key={s.uStart}
            type="button"
            className={styles.listButton}
            disabled={!s.part}
            onClick={() => s.part && select(`part:${s.part}`)}
          >
            <span>{s.label}</span>
            <span className={styles.mono}>{uRange(s)}</span>
          </button>
        ))}
        {rack.type.zeroU.map((z) => (
          <button key={z.id} type="button" className={styles.listButton} onClick={() => select(`part:${z.part}`)}>
            <span>{z.id} rear-corner 0U PDU</span>
            <span className={styles.mono}>0U</span>
          </button>
        ))}
      </Panel>
    </>
  );
}

/** What's selected on a sheet, a table or in 3D: its part, BOM line or rack, editable, and where it's drawn. */
export function Inspector(): ReactElement {
  const designId = useDesign((s) => s.designId);
  const selection = useDesign((s) => s.selection);
  const data = useDesign((s) => s.data);
  const d = useDesign((s) => s.derived);
  const select = useDesign((s) => s.select);
  const key = selection ? parseKey(selection) : null;

  if (!key) {
    return (
      <div className={styles.inspectorEmpty}>
        <h2>Inspector</h2>
        <p>Click any drawn element, table row, 3D part or BOM line to see its part, SKU, dimensions and cost.</p>
        <p>
          Edits recompute every sheet, the BOM total and the design checks at once. Save to keep them as the
          design&apos;s next version.
        </p>
        <p>Scroll to zoom, drag to pan.</p>
      </div>
    );
  }

  const bomId = key.kind === "bom" ? key.id : null;
  const partId = key.kind === "part" ? key.id : bomId ? (d.bomById.get(bomId)?.partId ?? null) : null;
  const part = partId ? d.partsById.get(partId) : undefined;
  const relatedBoms =
    partId && key.kind === "part"
      ? [...(d.bomByPart.get(partId) ?? []), ...(part?.coveredBy ? [d.bomById.get(part.coveredBy)] : [])].filter(
          (b) => b !== undefined,
        )
      : [];
  const usage = key.kind === "rack" ? [] : whereUsed(data, d, partId, bomId);
  const title =
    key.kind === "bom" ? `${key.id} · ${part?.name ?? ""}` : key.kind === "part" ? (part?.name ?? key.id) : key.id;

  return (
    <>
      <div className={styles.inspectorHead}>
        <div>
          <div className={styles.inspectorKind}>{key.kind === "bom" ? "BOM line" : key.kind}</div>
          <div className={styles.inspectorName}>{title}</div>
        </div>
        <button type="button" className={styles.rowButton} onClick={() => select(null)} title="Clear the selection">
          ✕
        </button>
      </div>

      {key.kind === "rack" ? <RackEditor id={key.id} /> : null}
      {bomId ? <BomLineEditor id={bomId} /> : null}
      {relatedBoms.length > 0 ? (
        <Panel title="BOM lines">
          {relatedBoms.map((b) => (
            <button key={b.id} type="button" className={styles.listButton} onClick={() => select(`bom:${b.id}`)}>
              <span>
                <span className={styles.mono}>{b.id}</span> {b.scope}
              </span>
              <span className={styles.num}>×{b.qty}</span>
            </button>
          ))}
        </Panel>
      ) : null}
      {part ? <PartEditor part={part} /> : null}
      {usage.length > 0 && designId ? (
        <Panel title="Where used">
          <ul className={styles.usage}>
            {usage.map((u) => (
              <li key={u.label}>
                <div>{u.label}</div>
                <div className={styles.chips}>
                  {[...new Set(u.sheets)].map((s) => (
                    <Link key={s} href={sheetHref(designId, s)} className={styles.chip}>
                      {s}
                    </Link>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </>
  );
}
