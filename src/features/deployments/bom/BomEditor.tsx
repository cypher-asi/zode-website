"use client";

import { useMemo, useRef, useState, useTransition, type ReactElement } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buildCluster } from "@/features/cluster/model/build";
import { SLOT_SECTIONS, SLOTS } from "@/features/cluster/model/slots";
import ui from "@/features/data-room/ui.module.css";
import d from "../deployments.module.css";
import { formatCount, formatUsd } from "../format";
import type { Deployment } from "../types";
import { saveBomAction } from "./actions";
import { phaseCoverage } from "./coverage";
import { phaseCluster, phaseLabel } from "./phase";
import { lineUsd, type Bom, type BomItem, type ItemStatus } from "./types";
import styles from "./bom.module.css";

interface QuoteDraft {
  id: string;
  vendor: string;
  reference: string;
  quotedOn: string;
  validUntil: string;
  quotedTotal: string;
  fileId: string;
  notes: string;
}

interface FillDraft {
  slotId: string;
  units: string;
}

interface ItemDraft {
  key: number;
  phaseId: string;
  quoteId: string;
  quoteSection: string;
  partNumber: string;
  description: string;
  quantity: string;
  quotedQuantity: string;
  unitUsd: string;
  status: ItemStatus;
  excludedReason: string;
  leadTime: string;
  notes: string;
  fills: FillDraft[];
}

const str = (value: number | string | null): string => (value === null ? "" : String(value));
const orNull = (value: string): string | null => value.trim() || null;
const numberOr = (raw: string, fallback: number | null): number | null => {
  const value = Number(raw.replace(/[$,\s]/g, ""));
  return raw.trim() && Number.isFinite(value) ? value : fallback;
};

const itemDraft = (key: number, item: BomItem): ItemDraft => ({
  key,
  phaseId: item.phaseId ?? "",
  quoteId: item.quoteId ?? "",
  quoteSection: item.quoteSection,
  partNumber: item.partNumber ?? "",
  description: item.description,
  quantity: str(item.quantity),
  quotedQuantity: str(item.quotedQuantity),
  unitUsd: str(item.unitUsd),
  status: item.status,
  excludedReason: item.excludedReason ?? "",
  leadTime: item.leadTime ?? "",
  notes: item.notes ?? "",
  fills: item.fills.map((fill) => ({ slotId: fill.slotId, units: str(fill.unitsPerItem) })),
});

/** The draft as the save action and the coverage both read it; blank figures read as nothing. */
const itemOf = (draft: ItemDraft): Omit<BomItem, "id"> => ({
  phaseId: orNull(draft.phaseId),
  quoteId: orNull(draft.quoteId),
  quoteSection: draft.quoteSection.trim(),
  partNumber: orNull(draft.partNumber),
  description: draft.description.trim(),
  quantity: numberOr(draft.quantity, 0)!,
  quotedQuantity: numberOr(draft.quotedQuantity, null),
  unitUsd: numberOr(draft.unitUsd, null),
  status: draft.status,
  excludedReason: orNull(draft.excludedReason),
  leadTime: orNull(draft.leadTime),
  notes: orNull(draft.notes),
  fills: draft.fills
    .filter((fill) => fill.slotId)
    .map((fill) => ({ slotId: fill.slotId, unitsPerItem: numberOr(fill.units, 1)! })),
});

const SLOT_GROUPS = SLOT_SECTIONS.map((section) => ({
  label: section.label,
  slots: SLOTS.filter((slot) => slot.section === section.id),
}));

function SlotPicker({ value, onChange }: { value: string; onChange: (slotId: string) => void }): ReactElement {
  return (
    <select className={ui.input} aria-label="Slot" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Choose a slot</option>
      {SLOT_GROUPS.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.slots.map((slot) => (
            <option key={slot.id} value={slot.id}>
              {slot.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/**
 * The ZODE team's editor for a deployment's BOM: its quotes, each linked to a
 * file in the deployment's data room, and every quoted line with the phase it
 * belongs to and the cluster-builder slots it fills, or why it's left out.
 * Each phase's coverage follows the lines as they're edited.
 */
export function BomEditor({
  deployment,
  bom,
  files,
}: {
  deployment: Deployment;
  bom: Bom;
  files: readonly { id: string; name: string }[];
}): ReactElement {
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<QuoteDraft[]>(() =>
    bom.quotes.map((quote) => ({
      id: quote.id,
      vendor: quote.vendor,
      reference: quote.reference ?? "",
      quotedOn: quote.quotedOn ?? "",
      validUntil: quote.validUntil ?? "",
      quotedTotal: str(quote.quotedTotalUsd),
      fileId: quote.dataRoomFileId ?? "",
      notes: quote.notes ?? "",
    })),
  );
  const [items, setItems] = useState<ItemDraft[]>(() => bom.items.map((item, i) => itemDraft(i, item)));
  const nextKey = useRef(items.length);
  const defaultPhase = deployment.phases[0]?.id ?? "";

  const coverages = useMemo(() => {
    const read = items.map((draft, i) => ({ ...itemOf(draft), id: String(i) }));
    return deployment.phases.flatMap((phase, index) => {
      const cluster = phaseCluster(deployment, phase);
      if (!cluster) return [];
      const coverage = phaseCoverage(
        buildCluster(cluster.config),
        cluster.copies,
        read.filter((item) => item.phaseId === phase.id),
      );
      return [{ phase, index, coverage }];
    });
  }, [items, deployment]);

  const updateQuote = (id: string, patch: Partial<QuoteDraft>) =>
    setQuotes((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const updateItem = (key: number, patch: Partial<ItemDraft>) =>
    setItems((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const addItem = (quoteId: string, quoteSection: string) =>
    setItems((rows) => {
      const draft = itemDraft(nextKey.current++, {
        id: "",
        phaseId: defaultPhase || null,
        quoteId: quoteId || null,
        quoteSection,
        partNumber: null,
        description: "",
        quantity: 1,
        quotedQuantity: null,
        unitUsd: null,
        status: "use",
        excludedReason: null,
        leadTime: null,
        notes: null,
        fills: [],
      });
      const last = rows.findLastIndex((row) => row.quoteId === quoteId);
      return last < 0 ? [...rows, draft] : [...rows.slice(0, last + 1), draft, ...rows.slice(last + 1)];
    });

  const save = () => {
    setError(null);
    startSaving(async () => {
      const result = await saveBomAction(deployment.id, {
        quotes: quotes.map((quote) => ({
          id: quote.id,
          vendor: quote.vendor.trim(),
          reference: orNull(quote.reference),
          quotedOn: orNull(quote.quotedOn),
          validUntil: orNull(quote.validUntil),
          quotedTotalUsd: numberOr(quote.quotedTotal, null),
          dataRoomFileId: orNull(quote.fileId),
          notes: orNull(quote.notes),
        })),
        items: items.map(itemOf),
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(`/portal/deployments/${deployment.id}`);
      router.refresh();
    });
  };

  const groups = [
    ...quotes.map((quote) => ({ id: quote.id, title: quote.vendor || "Untitled quote" })),
    { id: "", title: "Not from a quote" },
  ];
  const fileChoices = [{ id: "", name: "No file linked" }, ...files];

  return (
    <div className={styles.editor}>
      <section className={d.block} aria-label="Coverage">
        <h2 className={d.blockTitle}>Coverage</h2>
        {coverages.length ? (
          <ul className={styles.lines}>
            {coverages.map(({ phase, index, coverage }) => (
              <li key={phase.id}>
                <strong>{phaseLabel(phase, index)}</strong>: {formatUsd(coverage.totalUsd)} ·{" "}
                {coverage.counts.covered + coverage.counts.over} of {coverage.slots.length} slots covered
                {coverage.gaps ? ` · ${coverage.gaps} to fill` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className={d.muted}>No phase is on a platform the cluster builder has slots for.</p>
        )}
      </section>

      <section className={d.block} aria-label="Quotes">
        <div className={styles.head}>
          <h2 className={d.blockTitle}>Quotes</h2>
          <button
            type="button"
            className={ui.button}
            onClick={() =>
              setQuotes((rows) => [
                ...rows,
                {
                  id: crypto.randomUUID(),
                  vendor: "",
                  reference: "",
                  quotedOn: "",
                  validUntil: "",
                  quotedTotal: "",
                  fileId: "",
                  notes: "",
                },
              ])
            }
          >
            Add quote
          </button>
        </div>
        {!deployment.dataRoomId ? (
          <p className={d.muted}>Link the deployment to a data room to attach each quote&apos;s file.</p>
        ) : null}
        {quotes.map((quote) => (
          <div key={quote.id} className={styles.quoteForm}>
            <label className={ui.field}>
              <span className={ui.label}>Vendor *</span>
              <input
                className={ui.input}
                value={quote.vendor}
                maxLength={300}
                onChange={(event) => updateQuote(quote.id, { vendor: event.target.value })}
              />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Quote #</span>
              <input
                className={ui.input}
                value={quote.reference}
                maxLength={300}
                onChange={(event) => updateQuote(quote.id, { reference: event.target.value })}
              />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Quoted on</span>
              <input
                type="date"
                className={ui.input}
                value={quote.quotedOn}
                onChange={(event) => updateQuote(quote.id, { quotedOn: event.target.value })}
              />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Valid until</span>
              <input
                type="date"
                className={ui.input}
                value={quote.validUntil}
                onChange={(event) => updateQuote(quote.id, { validUntil: event.target.value })}
              />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Stated total (USD)</span>
              <input
                className={ui.input}
                inputMode="decimal"
                value={quote.quotedTotal}
                onChange={(event) => updateQuote(quote.id, { quotedTotal: event.target.value })}
              />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>File in the data room</span>
              <select
                className={ui.input}
                value={quote.fileId}
                disabled={!deployment.dataRoomId}
                onChange={(event) => updateQuote(quote.id, { fileId: event.target.value })}
              >
                {fileChoices.map((file) => (
                  <option key={file.id} value={file.id}>
                    {file.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={ui.field} data-wide="">
              <span className={ui.label}>Notes</span>
              <textarea
                className={ui.textarea}
                rows={2}
                maxLength={2000}
                value={quote.notes}
                onChange={(event) => updateQuote(quote.id, { notes: event.target.value })}
              />
            </label>
            <div className={styles.quoteFormFoot}>
              <span className={d.muted}>
                {formatCount(items.filter((item) => item.quoteId === quote.id).length)} lines
              </span>
              <button
                type="button"
                className={ui.danger}
                onClick={() => {
                  setQuotes((rows) => rows.filter((row) => row.id !== quote.id));
                  setItems((rows) => rows.filter((row) => row.quoteId !== quote.id));
                }}
              >
                Remove quote and its lines
              </button>
            </div>
          </div>
        ))}
      </section>

      {groups.map((group) => {
        const rows = items.filter((item) => item.quoteId === group.id);
        if (!group.id && !rows.length) {
          return (
            <div key="none">
              <button type="button" className={ui.button} onClick={() => addItem("", "")}>
                Add a line not from a quote
              </button>
            </div>
          );
        }
        const total = rows.reduce((sum, row) => {
          const item = itemOf(row);
          return item.status === "use" ? sum + lineUsd(item) : sum;
        }, 0);
        return (
          <section key={group.id || "none"} className={d.block} aria-label={`${group.title} lines`}>
            <div className={styles.head}>
              <h2 className={d.blockTitle}>
                {group.title} · {formatCount(rows.length)} lines · {formatUsd(total)} in BOM
              </h2>
              <button
                type="button"
                className={ui.button}
                onClick={() => addItem(group.id, rows.at(-1)?.quoteSection ?? "")}
              >
                Add line
              </button>
            </div>
            <div className={styles.tableWrap}>
              <table className={`${styles.table} ${styles.editTable}`}>
                <thead>
                  <tr>
                    <th scope="col" data-text="">
                      Section
                    </th>
                    <th scope="col" data-text="">
                      Part #
                    </th>
                    <th scope="col" data-text="">
                      Description
                    </th>
                    <th scope="col" data-text="">
                      Phase
                    </th>
                    <th scope="col">Qty</th>
                    <th scope="col">Quoted qty</th>
                    <th scope="col">Unit $</th>
                    <th scope="col" data-text="">
                      Status
                    </th>
                    <th scope="col" data-text="">
                      Slots
                    </th>
                    <th scope="col">
                      <span className={styles.srOnly}>Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key} data-excluded={row.status === "excluded" ? "" : undefined}>
                      <td>
                        <input
                          className={ui.input}
                          aria-label="Section"
                          value={row.quoteSection}
                          onChange={(event) => updateItem(row.key, { quoteSection: event.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          className={ui.input}
                          aria-label="Part number"
                          value={row.partNumber}
                          onChange={(event) => updateItem(row.key, { partNumber: event.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          className={ui.input}
                          aria-label="Description"
                          value={row.description}
                          onChange={(event) => updateItem(row.key, { description: event.target.value })}
                        />
                      </td>
                      <td>
                        <select
                          className={ui.input}
                          aria-label="Phase"
                          value={row.phaseId}
                          onChange={(event) => updateItem(row.key, { phaseId: event.target.value })}
                        >
                          <option value="">No phase</option>
                          {deployment.phases.map((phase, i) => (
                            <option key={phase.id} value={phase.id}>
                              {phaseLabel(phase, i)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td data-narrow="">
                        <input
                          className={ui.input}
                          inputMode="decimal"
                          aria-label="Quantity"
                          value={row.quantity}
                          onChange={(event) => updateItem(row.key, { quantity: event.target.value })}
                        />
                      </td>
                      <td data-narrow="">
                        <input
                          className={ui.input}
                          inputMode="decimal"
                          aria-label="Quoted quantity"
                          placeholder="Same"
                          value={row.quotedQuantity}
                          onChange={(event) => updateItem(row.key, { quotedQuantity: event.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          className={ui.input}
                          inputMode="decimal"
                          aria-label="Unit price"
                          placeholder="Included"
                          value={row.unitUsd}
                          onChange={(event) => updateItem(row.key, { unitUsd: event.target.value })}
                        />
                      </td>
                      <td>
                        <select
                          className={ui.input}
                          aria-label="Status"
                          value={row.status}
                          onChange={(event) => updateItem(row.key, { status: event.target.value as ItemStatus })}
                        >
                          <option value="use">In BOM</option>
                          <option value="excluded">Excluded</option>
                        </select>
                      </td>
                      <td>
                        {row.status === "excluded" ? (
                          <input
                            className={ui.input}
                            aria-label="Why it's excluded"
                            placeholder="Why it's left out"
                            value={row.excludedReason}
                            onChange={(event) => updateItem(row.key, { excludedReason: event.target.value })}
                          />
                        ) : (
                          <div className={styles.fills}>
                            {row.fills.map((fill, i) => (
                              <div key={i} className={styles.fill}>
                                <SlotPicker
                                  value={fill.slotId}
                                  onChange={(slotId) =>
                                    updateItem(row.key, {
                                      fills: row.fills.map((f, j) => (j === i ? { ...f, slotId } : f)),
                                    })
                                  }
                                />
                                <input
                                  className={ui.input}
                                  inputMode="decimal"
                                  aria-label="Units per item"
                                  title="Slot units each item covers"
                                  value={fill.units}
                                  onChange={(event) =>
                                    updateItem(row.key, {
                                      fills: row.fills.map((f, j) => (j === i ? { ...f, units: event.target.value } : f)),
                                    })
                                  }
                                />
                                <button
                                  type="button"
                                  className={ui.iconButton}
                                  aria-label="Remove slot"
                                  onClick={() => updateItem(row.key, { fills: row.fills.filter((_, j) => j !== i) })}
                                >
                                  <svg viewBox="0 0 16 16" aria-hidden="true">
                                    <path d="M4 4l8 8M12 4l-8 8" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                            <div>
                              <button
                                type="button"
                                className={ui.button}
                                onClick={() => updateItem(row.key, { fills: [...row.fills, { slotId: "", units: "1" }] })}
                              >
                                Add slot
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={ui.iconButton}
                          aria-label="Remove line"
                          onClick={() => setItems((all) => all.filter((item) => item.key !== row.key))}
                        >
                          <svg viewBox="0 0 16 16" aria-hidden="true">
                            <path d="M4 4l8 8M12 4l-8 8" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <div className={styles.sticky}>
        {error ? (
          <p className={ui.error} role="alert" data-start="">
            {error}
          </p>
        ) : null}
        <Link href={`/portal/deployments/${deployment.id}`} className={ui.button}>
          Cancel
        </Link>
        <button type="button" className={ui.primary} disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save BOM"}
        </button>
      </div>
    </div>
  );
}
