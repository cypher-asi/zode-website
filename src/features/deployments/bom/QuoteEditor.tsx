"use client";

import { useState, useTransition, type ReactElement } from "react";
import ui from "@/features/data-room/ui.module.css";
import { plural } from "../format";
import { saveQuoteAction } from "./actions";
import { formatCents, lineUsd, type Quote, type QuoteItem } from "./types";
import styles from "./bom.module.css";

interface ItemDraft {
  id: string;
  section: string;
  partNumber: string;
  manufacturer: string;
  description: string;
  quantity: string;
  unitUsd: string;
  leadTime: string;
  notes: string;
}

const str = (value: number | string | null): string => (value === null ? "" : String(value));
const orNull = (value: string): string | null => value.trim() || null;
const numberOr = (raw: string, fallback: number | null): number | null => {
  const value = Number(raw.replace(/[$,\s]/g, ""));
  return raw.trim() && Number.isFinite(value) ? value : fallback;
};

const itemOf = (quoteId: string, draft: ItemDraft): QuoteItem => ({
  id: draft.id,
  quoteId,
  section: draft.section.trim(),
  partNumber: orNull(draft.partNumber),
  manufacturer: orNull(draft.manufacturer),
  description: draft.description.trim(),
  quantity: numberOr(draft.quantity, null),
  unitUsd: numberOr(draft.unitUsd, null),
  leadTime: orNull(draft.leadTime),
  notes: orNull(draft.notes),
});

const X_ICON = (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

/**
 * One quote's details and price list, edited together and saved in one go.
 * Items keep their ids, so BOM lines picked from them stay linked; removing
 * one leaves those lines with what they copied.
 */
export function QuoteEditor({
  deploymentId,
  quote,
  items,
  used,
  roomFiles,
  hasRoom,
  onDone,
}: {
  deploymentId: string;
  quote: Quote;
  items: readonly QuoteItem[];
  /** Ids of its items BOM lines were picked from. */
  used: ReadonlySet<string>;
  roomFiles: readonly { id: string; name: string }[];
  hasRoom: boolean;
  onDone: () => void;
}): ReactElement {
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState({
    vendor: quote.vendor,
    reference: quote.reference ?? "",
    quotedOn: quote.quotedOn ?? "",
    validUntil: quote.validUntil ?? "",
    quotedTotal: str(quote.quotedTotalUsd),
    fileId: quote.dataRoomFileId ?? "",
    notes: quote.notes ?? "",
  });
  const [drafts, setDrafts] = useState<ItemDraft[]>(() =>
    items.map((item) => ({
      id: item.id,
      section: item.section,
      partNumber: item.partNumber ?? "",
      manufacturer: item.manufacturer ?? "",
      description: item.description,
      quantity: str(item.quantity),
      unitUsd: str(item.unitUsd),
      leadTime: item.leadTime ?? "",
      notes: item.notes ?? "",
    })),
  );
  const uploaded = quote.file?.source === "upload";
  const total = drafts.reduce((sum, draft) => sum + lineUsd(itemOf(quote.id, draft)), 0);

  const set = (patch: Partial<typeof details>) => setDetails((current) => ({ ...current, ...patch }));
  const setItem = (id: string, patch: Partial<ItemDraft>) =>
    setDrafts((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const addItem = () =>
    setDrafts((rows) => [
      ...rows,
      {
        id: crypto.randomUUID(),
        section: rows.at(-1)?.section ?? "",
        partNumber: "",
        manufacturer: "",
        description: "",
        quantity: "",
        unitUsd: "",
        leadTime: "",
        notes: "",
      },
    ]);

  const save = () => {
    setError(null);
    startSaving(async () => {
      const result = await saveQuoteAction(deploymentId, {
        quote: {
          id: quote.id,
          vendor: details.vendor.trim(),
          reference: orNull(details.reference),
          quotedOn: orNull(details.quotedOn),
          validUntil: orNull(details.validUntil),
          quotedTotalUsd: numberOr(details.quotedTotal, null),
          dataRoomFileId: orNull(details.fileId),
          notes: orNull(details.notes),
        },
        items: drafts.map((draft) => itemOf(quote.id, draft)),
      });
      if (result.error) setError(result.error);
      else onDone();
    });
  };

  const text = (key: keyof ItemDraft, label: string, draft: ItemDraft, decimal = false) => (
    <input
      className={ui.input}
      aria-label={label}
      inputMode={decimal ? "decimal" : undefined}
      placeholder={key === "unitUsd" ? "Included" : undefined}
      value={draft[key]}
      onChange={(event) => setItem(draft.id, { [key]: event.target.value })}
    />
  );

  return (
    <div className={styles.quoteEditor}>
      <div className={styles.quoteForm}>
        <label className={ui.field}>
          <span className={ui.label}>Vendor *</span>
          <input className={ui.input} value={details.vendor} maxLength={300} onChange={(e) => set({ vendor: e.target.value })} />
        </label>
        <label className={ui.field}>
          <span className={ui.label}>Quote #</span>
          <input
            className={ui.input}
            value={details.reference}
            maxLength={300}
            onChange={(e) => set({ reference: e.target.value })}
          />
        </label>
        <label className={ui.field}>
          <span className={ui.label}>Quoted on</span>
          <input type="date" className={ui.input} value={details.quotedOn} onChange={(e) => set({ quotedOn: e.target.value })} />
        </label>
        <label className={ui.field}>
          <span className={ui.label}>Valid until</span>
          <input
            type="date"
            className={ui.input}
            value={details.validUntil}
            onChange={(e) => set({ validUntil: e.target.value })}
          />
        </label>
        <label className={ui.field}>
          <span className={ui.label}>Stated total (USD)</span>
          <input
            className={ui.input}
            inputMode="decimal"
            value={details.quotedTotal}
            onChange={(e) => set({ quotedTotal: e.target.value })}
          />
        </label>
        {uploaded ? null : (
          <label className={ui.field}>
            <span className={ui.label}>File in the data room</span>
            <select
              className={ui.input}
              value={details.fileId}
              disabled={!hasRoom}
              onChange={(e) => set({ fileId: e.target.value })}
            >
              <option value="">{hasRoom ? "No file linked" : "No data room linked"}</option>
              {roomFiles.map((file) => (
                <option key={file.id} value={file.id}>
                  {file.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={ui.field} data-wide="">
          <span className={ui.label}>Notes</span>
          <textarea
            className={ui.textarea}
            rows={2}
            maxLength={2000}
            value={details.notes}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </label>
      </div>

      <div className={styles.head}>
        <h3 className={styles.phaseTitle}>
          Price list · {plural(drafts.length, "item")} · {formatCents(total)}
        </h3>
        <button type="button" className={ui.button} onClick={addItem}>
          Add item
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
                Manufacturer
              </th>
              <th scope="col" data-text="">
                Description
              </th>
              <th scope="col">Qty</th>
              <th scope="col">Unit $</th>
              <th scope="col" data-text="">
                Lead time
              </th>
              <th scope="col">
                <span className={styles.srOnly}>Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((draft) => (
              <tr key={draft.id}>
                <td>{text("section", "Section", draft)}</td>
                <td>{text("partNumber", "Part number", draft)}</td>
                <td>{text("manufacturer", "Manufacturer", draft)}</td>
                <td className={styles.descCell}>
                  {text("description", "Description", draft)}
                  {used.has(draft.id) ? <span className={styles.sub}>In the BOM</span> : null}
                </td>
                <td data-narrow="">{text("quantity", "Quoted quantity", draft, true)}</td>
                <td data-narrow="">{text("unitUsd", "Unit price", draft, true)}</td>
                <td>{text("leadTime", "Lead time", draft)}</td>
                <td>
                  <button
                    type="button"
                    className={ui.iconButton}
                    aria-label="Remove item"
                    onClick={() => setDrafts((rows) => rows.filter((row) => row.id !== draft.id))}
                  >
                    {X_ICON}
                  </button>
                </td>
              </tr>
            ))}
            {drafts.length ? null : (
              <tr>
                <td data-text="" colSpan={8}>
                  <span className={styles.sub}>No items yet. Add the ones the quote prices, to pick into the BOM.</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.sticky}>
        {error ? (
          <p className={ui.error} role="alert" data-start="">
            {error}
          </p>
        ) : null}
        <button type="button" className={ui.button} onClick={onDone} disabled={saving}>
          Cancel
        </button>
        <button type="button" className={ui.primary} disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save quote"}
        </button>
      </div>
    </div>
  );
}
