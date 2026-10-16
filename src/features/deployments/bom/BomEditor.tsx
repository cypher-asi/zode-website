"use client";

import { Fragment, useMemo, useRef, useState, useTransition, type ReactElement } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ui from "@/features/data-room/ui.module.css";
import d from "../deployments.module.css";
import { formatCount, formatUsd, plural } from "../format";
import { platformLabel, type Deployment } from "../types";
import { saveBomLinesAction } from "./actions";
import { phaseCoverage, stillNeeded, type SlotCoverage } from "./coverage";
import { planSummary, qty, slotFill, SlotName, Status } from "./BomOverview";
import { phaseLabel, phasePlan } from "./phase";
import { SLOT_SECTIONS, SLOTS, slotById, type Slot } from "./slots";
import { formatCents, lineUsd, urlSite, type Bom, type BomLine, type QuoteItem } from "./types";
import styles from "./bom.module.css";

interface LineDraft {
  key: number;
  phaseId: string;
  /** "" for a line no slot stands for. */
  slotId: string;
  /** "" for a line typed in, not picked from a quote. */
  quoteItemId: string;
  partNumber: string;
  manufacturer: string;
  description: string;
  quantity: string;
  unitUsd: string;
  notes: string;
  url: string;
}

const str = (value: number | string | null): string => (value === null ? "" : String(value));
const orNull = (value: string): string | null => value.trim() || null;
const numberOr = (raw: string, fallback: number | null): number | null => {
  const value = Number(raw.replace(/[$,\s]/g, ""));
  return raw.trim() && Number.isFinite(value) ? value : fallback;
};

/** The draft as the save action and the coverage both read it; a blank quantity reads as none. */
const lineOf = (draft: LineDraft): BomLine => ({
  id: String(draft.key),
  phaseId: draft.phaseId,
  slotId: draft.slotId || null,
  quoteItemId: draft.quoteItemId || null,
  partNumber: orNull(draft.partNumber),
  manufacturer: orNull(draft.manufacturer),
  description: draft.description.trim(),
  quantity: numberOr(draft.quantity, 0)!,
  unitUsd: numberOr(draft.unitUsd, null),
  notes: orNull(draft.notes),
  url: orNull(draft.url),
});

const ellipsis = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

const SLOT_GROUPS = SLOT_SECTIONS.map((section) => ({
  label: section.label,
  slots: SLOTS.filter((slot) => slot.section === section.id),
}));

const X_ICON = (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

interface ItemGroup {
  label: string;
  items: { id: string; label: string }[];
}

function LineRow({
  line,
  item,
  groups,
  fit,
  onChange,
  onPick,
  onRemove,
}: {
  line: LineDraft;
  /** The quote item it was picked from, as the quote has it now. */
  item: QuoteItem | null;
  groups: readonly ItemGroup[];
  /** What the slot still needs besides the slot's other lines; null when nothing says. */
  fit: number | null;
  onChange: (patch: Partial<LineDraft>) => void;
  onPick: (itemId: string) => void;
  onRemove: () => void;
}): ReactElement {
  const read = lineOf(line);
  const quotedUnit = item?.unitUsd ?? null;
  return (
    <tr>
      <td className={styles.pickCell}>
        <select
          className={ui.input}
          aria-label="Quote item"
          value={item ? line.quoteItemId : ""}
          onChange={(event) => onPick(event.target.value)}
        >
          <option value="">Typed in, not from a quote</option>
          {groups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.items.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </td>
      <td>
        <input
          className={ui.input}
          aria-label="Part number"
          value={line.partNumber}
          onChange={(event) => onChange({ partNumber: event.target.value })}
        />
      </td>
      <td>
        <input
          className={ui.input}
          aria-label="Manufacturer"
          value={line.manufacturer}
          onChange={(event) => onChange({ manufacturer: event.target.value })}
        />
      </td>
      <td>
        <input
          className={ui.input}
          aria-label="Description"
          value={line.description}
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </td>
      <td>
        <input
          className={ui.input}
          inputMode="url"
          aria-label="Link to the item"
          placeholder="https://"
          value={line.url}
          onChange={(event) => onChange({ url: event.target.value })}
        />
        {item?.url && item.url !== read.url ? (
          <button
            type="button"
            className={styles.inlineAction}
            title={`Use the quote's link: ${item.url}`}
            onClick={() => onChange({ url: item.url ?? "" })}
          >
            Quote: {urlSite(item.url)}
          </button>
        ) : null}
      </td>
      <td data-narrow="">
        <input
          className={ui.input}
          inputMode="decimal"
          aria-label="Quantity"
          value={line.quantity}
          onChange={(event) => onChange({ quantity: event.target.value })}
        />
        {fit !== null && fit > 0 && Math.abs(fit - read.quantity) > 1e-6 ? (
          <button
            type="button"
            className={styles.inlineAction}
            title="Set the quantity to what the slot still needs"
            onClick={() => onChange({ quantity: str(fit) })}
          >
            Fit to {qty(fit)}
          </button>
        ) : item?.quantity != null ? (
          <span className={styles.sub}>Quoted {qty(item.quantity)}</span>
        ) : null}
      </td>
      <td data-narrow="">
        <input
          className={ui.input}
          inputMode="decimal"
          aria-label="Unit price"
          placeholder="Included"
          value={line.unitUsd}
          onChange={(event) => onChange({ unitUsd: event.target.value })}
        />
        {item && quotedUnit !== read.unitUsd ? (
          <button
            type="button"
            className={styles.inlineAction}
            title="Use the quote's unit price"
            onClick={() => onChange({ unitUsd: str(quotedUnit) })}
          >
            Quote: {quotedUnit === null ? "included" : formatCents(quotedUnit)}
          </button>
        ) : null}
      </td>
      <td className={styles.nowrap}>{read.unitUsd === null ? "Included" : formatCents(lineUsd(read))}</td>
      <td>
        <button type="button" className={ui.iconButton} aria-label="Remove line" onClick={onRemove}>
          {X_ICON}
        </button>
      </td>
    </tr>
  );
}

/**
 * The ZODE team's editor for a deployment's BOM. Each phase's slots take
 * lines picked from the quotes' price lists (edited on the Quotes tab):
 * picking an item copies its part number, manufacturer, description and unit
 * price, and the quantity is sized to what the slot needs, so every line
 * shows what it costs.
 */
export function BomEditor({ deployment, bom }: { deployment: Deployment; bom: Bom }): ReactElement {
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<LineDraft[]>(() =>
    bom.lines.map((line, key) => ({
      key,
      phaseId: line.phaseId,
      slotId: line.slotId ?? "",
      quoteItemId: line.quoteItemId ?? "",
      partNumber: line.partNumber ?? "",
      manufacturer: line.manufacturer ?? "",
      description: line.description,
      quantity: str(line.quantity),
      unitUsd: str(line.unitUsd),
      notes: line.notes ?? "",
      url: line.url ?? "",
    })),
  );
  const nextKey = useRef(lines.length);
  const [phaseId, setPhaseId] = useState(
    () => (deployment.phases.find((p) => bom.lines.some((line) => line.phaseId === p.id)) ?? deployment.phases[0])?.id ?? "",
  );

  const plans = useMemo(
    () => new Map(deployment.phases.map((phase) => [phase.id, phasePlan(deployment, phase)])),
    [deployment],
  );
  const read = useMemo(() => lines.map(lineOf), [lines]);
  const coverages = useMemo(
    () =>
      new Map(
        deployment.phases.map((phase) => {
          const plan = plans.get(phase.id)!;
          return [phase.id, phaseCoverage(plan.sizing, plan.config, read.filter((line) => line.phaseId === phase.id))];
        }),
      ),
    [deployment.phases, plans, read],
  );

  const quoteItems = useMemo(() => new Map(bom.items.map((item) => [item.id, item])), [bom.items]);
  const groups = useMemo<ItemGroup[]>(
    () =>
      bom.quotes.flatMap((quote) => {
        const sections = new Map<string, ItemGroup["items"]>();
        for (const item of bom.items) {
          if (item.quoteId !== quote.id) continue;
          const name = [item.partNumber, item.description].filter(Boolean).join(" · ") || "Untitled item";
          const price = item.unitUsd === null ? "included" : formatCents(item.unitUsd);
          sections.set(item.section, [
            ...(sections.get(item.section) ?? []),
            { id: item.id, label: `${ellipsis(name, 80)} · ${price}` },
          ]);
        }
        return [...sections].map(([section, options]) => ({
          label: `${quote.vendor || "Untitled quote"} · ${section || "Items"}`,
          items: options,
        }));
      }),
    [bom.quotes, bom.items],
  );

  const updateLine = (key: number, patch: Partial<LineDraft>) =>
    setLines((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const addLine = (slotId: string) =>
    setLines((rows) => [
      ...rows,
      {
        key: nextKey.current++,
        phaseId,
        slotId,
        quoteItemId: "",
        partNumber: "",
        manufacturer: "",
        description: "",
        quantity: "",
        unitUsd: "",
        notes: "",
        url: "",
      },
    ]);

  const coverage = coverages.get(phaseId);
  const phaseIndex = deployment.phases.findIndex((p) => p.id === phaseId);
  const phase = deployment.phases[phaseIndex];
  const plan = plans.get(phaseId);

  /** What the line's slot still needs once its other lines in this phase are counted. */
  const fitFor = (line: LineDraft, row: SlotCoverage | undefined): number | null =>
    row
      ? stillNeeded(
          row,
          read.filter((other) => other.phaseId === line.phaseId && other.slotId === row.slot.id && other.id !== String(line.key)),
        )
      : null;

  const pick = (line: LineDraft, row: SlotCoverage | undefined, itemId: string) => {
    const item = quoteItems.get(itemId);
    if (!item) {
      updateLine(line.key, { quoteItemId: "" });
      return;
    }
    const fit = fitFor(line, row);
    updateLine(line.key, {
      quoteItemId: item.id,
      partNumber: item.partNumber ?? "",
      manufacturer: item.manufacturer ?? "",
      description: item.description,
      url: item.url ?? "",
      unitUsd: str(item.unitUsd),
      quantity: str(fit !== null && fit > 0 ? fit : (item.quantity ?? 1)),
    });
  };

  const save = () => {
    setError(null);
    startSaving(async () => {
      const result = await saveBomLinesAction(deployment.id, read);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(`/portal/deployments/${deployment.id}?tab=bom`);
      router.refresh();
    });
  };

  const lineRows = (rows: readonly LineDraft[], row: SlotCoverage | undefined) =>
    rows.map((line) => (
      <LineRow
        key={line.key}
        line={line}
        item={quoteItems.get(line.quoteItemId) ?? null}
        groups={groups}
        fit={fitFor(line, row)}
        onChange={(patch) => updateLine(line.key, patch)}
        onPick={(itemId) => pick(line, row, itemId)}
        onRemove={() => setLines((all) => all.filter((other) => other.key !== line.key))}
      />
    ));

  const phaseLines = lines.filter((line) => line.phaseId === phaseId);
  const shownSlots = new Set(coverage?.slots.map((row) => row.slot.id));
  const otherLines = phaseLines.filter((line) => !line.slotId || !slotById(line.slotId));
  const addable: { label: string; slots: Slot[] }[] = SLOT_GROUPS.map((group) => ({
    label: group.label,
    slots: group.slots.filter((slot) => !shownSlots.has(slot.id)),
  })).filter((group) => group.slots.length);

  return (
    <div className={styles.editor}>
      <section className={d.block} aria-label="Line items">
        <div className={styles.head}>
          <h2 className={d.blockTitle}>Line items</h2>
        </div>
        {deployment.phases.length ? (
          <div className={styles.tabs} role="group" aria-label="Phase">
            {deployment.phases.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className={styles.tab}
                aria-pressed={p.id === phaseId}
                onClick={() => setPhaseId(p.id)}
              >
                {phaseLabel(p, i)} · {formatUsd(coverages.get(p.id)?.totalUsd ?? 0)}
              </button>
            ))}
          </div>
        ) : (
          <p className={d.muted}>Add a phase to the deployment first: each phase has its own BOM.</p>
        )}

        {phase && coverage && plan ? (
          <>
            <p className={d.muted}>
              {formatCount(phase.nodes)} {platformLabel(phase.platform)} nodes. Slots are what{" "}
              {planSummary(phase, plan)} needs, built to the deployment&apos;s configuration
              {coverage.gaps ? `; ${coverage.gaps} still to fill` : ""}. Total {formatCents(coverage.totalUsd)} over{" "}
              {plural(phaseLines.length, "line")}.
            </p>
            <div className={styles.tableWrap}>
              <table className={`${styles.table} ${styles.editTable}`}>
                <thead>
                  <tr>
                    <th scope="col" data-text="">
                      From quote
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
                    <th scope="col" data-text="">
                      Link
                    </th>
                    <th scope="col">Qty</th>
                    <th scope="col">Unit $</th>
                    <th scope="col">Line total</th>
                    <th scope="col">
                      <span className={styles.srOnly}>Remove</span>
                    </th>
                  </tr>
                </thead>
                {SLOT_SECTIONS.map((section) => {
                  const rows = coverage.slots.filter((row) => row.slot.section === section.id);
                  if (!rows.length) return null;
                  return (
                    <tbody key={section.id}>
                      <tr data-group="">
                        <th colSpan={7}>{section.label}</th>
                        <th className={styles.nowrap}>{formatUsd(coverage.sectionUsd.get(section.id) ?? 0)}</th>
                        <th />
                      </tr>
                      {rows.map((row) => (
                        <Fragment key={row.slot.id}>
                          <tr data-slot="">
                            <th colSpan={7} data-text="">
                              <span className={styles.slotHead}>
                                <span>
                                  <SlotName row={row} />
                                </span>
                                <span className={styles.sub}>{slotFill(row)}</span>
                                <Status row={row} />
                                <button
                                  type="button"
                                  className={styles.inlineAction}
                                  onClick={() => addLine(row.slot.id)}
                                >
                                  Add line
                                </button>
                              </span>
                            </th>
                            <td className={styles.nowrap}>{row.usd ? formatCents(row.usd) : ""}</td>
                            <td />
                          </tr>
                          {lineRows(
                            phaseLines.filter((line) => line.slotId === row.slot.id),
                            row,
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  );
                })}
                <tbody>
                  <tr data-group="">
                    <th colSpan={7}>
                      <span className={styles.slotHead}>
                        <span>Other line items</span>
                        <button type="button" className={styles.inlineAction} onClick={() => addLine("")}>
                          Add line
                        </button>
                      </span>
                    </th>
                    <th className={styles.nowrap}>{formatUsd(coverage.sectionUsd.get("other") ?? 0)}</th>
                    <th />
                  </tr>
                  {otherLines.length ? (
                    lineRows(otherLines, undefined)
                  ) : (
                    <tr>
                      <td data-text="" colSpan={9}>
                        <span className={styles.sub}>Costs no slot stands for, like a section subtotal.</span>
                      </td>
                    </tr>
                  )}
                </tbody>
                <tbody>
                  <tr data-total="">
                    <th colSpan={7} data-text="">
                      {phaseLabel(phase, phaseIndex)} total
                    </th>
                    <td className={styles.nowrap}>{formatCents(coverage.totalUsd)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
            {addable.length ? (
              <label className={styles.addSlot}>
                <span className={ui.label}>Add a line to another slot</span>
                <select
                  className={ui.input}
                  value=""
                  onChange={(event) => {
                    if (event.target.value) addLine(event.target.value);
                  }}
                >
                  <option value="">Choose a slot</option>
                  {addable.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.slots.map((slot) => (
                        <option key={slot.id} value={slot.id}>
                          {slot.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            ) : null}
          </>
        ) : null}
      </section>

      <div className={styles.sticky}>
        {error ? (
          <p className={ui.error} role="alert" data-start="">
            {error}
          </p>
        ) : null}
        <Link href={`/portal/deployments/${deployment.id}?tab=bom`} className={ui.button}>
          Cancel
        </Link>
        <button type="button" className={ui.primary} disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save BOM"}
        </button>
      </div>
    </div>
  );
}
