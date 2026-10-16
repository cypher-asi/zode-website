"use client";

import { useState, useTransition, type ReactElement } from "react";
import Link from "next/link";
import { savePhaseClusterAction } from "@/features/deployments/bom/actions";
import { STATUS_LABELS, type PhaseCoverage, type SlotCoverage } from "@/features/deployments/bom/coverage";
import { formatCents, lineName, lineUsd, type BomLine } from "@/features/deployments/bom/types";
import { count } from "./format";
import { GPUS_PER_NODE } from "./model/catalog";
import { SLOT_SECTIONS } from "./model/slots";
import type { ClusterConfig } from "./model/types";
import styles from "./BomPanel.module.css";

/** One deployment phase's BOM, loaded into the builder for the ZODE team. */
export interface BuilderBom {
  deploymentId: string;
  deploymentName: string;
  phaseId: string;
  phaseLabel: string;
  phaseNodes: number;
  /** The phase's saved config; null while it's worked out from the phase. */
  savedConfig: ClusterConfig | null;
  copies: number;
  lines: BomLine[];
  /** The vendor of each quote item the lines came from, by item id. */
  vendors: Record<string, string>;
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const qty = (value: number) => count(Math.round(value * 100) / 100);
const sameConfig = (a: ClusterConfig, b: ClusterConfig | null) =>
  !!b && (Object.keys(a) as (keyof ClusterConfig)[]).every((key) => a[key] === b[key]);

function Dot({ row }: { row: SlotCoverage }): ReactElement {
  return (
    <span
      className={styles.dot}
      data-status={row.status}
      data-optional={row.slot.optional && row.status === "missing" ? "" : undefined}
      aria-hidden="true"
    />
  );
}

/** The phase's slots, section by section, each with what the BOM brings against what this cluster needs. */
export function BomPanel({
  bom,
  config,
  copies,
  onCopies,
  coverage,
}: {
  bom: BuilderBom;
  config: ClusterConfig;
  copies: number;
  onCopies: (copies: number) => void;
  coverage: PhaseCoverage;
}): ReactElement {
  const [saving, startSaving] = useTransition();
  const [saved, setSaved] = useState<{ config: ClusterConfig | null; copies: number }>({
    config: bom.savedConfig,
    copies: bom.copies,
  });
  const [error, setError] = useState<string | null>(null);
  const nodes = config.nodes * copies;
  const unsaved = !sameConfig(config, saved.config) || copies !== saved.copies;
  const needed = coverage.slots.filter((row) => !row.slot.optional);
  const covered = needed.filter((row) => row.status === "covered" || row.status === "over").length;

  const save = () => {
    setError(null);
    startSaving(async () => {
      const result = await savePhaseClusterAction(bom.deploymentId, bom.phaseId, config, copies);
      if (result.error) setError(result.error);
      else setSaved({ config, copies });
    });
  };

  return (
    <section className={styles.root} aria-label="Deployment BOM">
      <div>
        <p className={styles.eyebrow}>Deployment BOM</p>
        <h2 className={styles.title}>
          {bom.deploymentName} · {bom.phaseLabel}
        </h2>
        <Link className={styles.link} href={`/portal/deployments/${bom.deploymentId}?tab=bom`} prefetch={false}>
          Back to the BOM
        </Link>
      </div>

      <label className={styles.copies}>
        <span>Identical clusters in the phase</span>
        <input
          type="number"
          min={1}
          max={64}
          value={copies}
          onChange={(event) => {
            const value = Math.round(Number(event.target.value));
            if (value >= 1 && value <= 64) onCopies(value);
          }}
        />
        <p className={styles.note} data-warn={nodes !== bom.phaseNodes ? "" : undefined}>
          {count(nodes)} nodes, against the phase&apos;s {count(bom.phaseNodes)}.
          {saved.config ? "" : " Worked out from the phase until it's saved."}
        </p>
      </label>
      {unsaved ? (
        <button type="button" className={styles.save} disabled={saving} onClick={save}>
          {saving ? "Saving…" : `Save as ${bom.phaseLabel}'s cluster`}
        </button>
      ) : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <dl className={styles.figures}>
        <div>
          <dt>BOM total</dt>
          <dd>{usd.format(coverage.totalUsd)}</dd>
        </div>
        <div>
          <dt>Per GPU</dt>
          <dd>{usd.format(coverage.totalUsd / (nodes * GPUS_PER_NODE))}</dd>
        </div>
        <div>
          <dt>Slots covered</dt>
          <dd>
            {covered} / {needed.length}
          </dd>
        </div>
      </dl>

      {SLOT_SECTIONS.map((section) => {
        const rows = coverage.slots.filter((row) => row.slot.section === section.id);
        if (!rows.length) return null;
        return (
          <div key={section.id} className={styles.section}>
            <h3 className={styles.sectionTitle}>{section.label}</h3>
            <ul className={styles.slots}>
              {rows.map((row) => (
                <li
                  key={row.slot.id}
                  className={styles.slot}
                  title={row.slot.optional && row.status === "missing" ? "Optional" : STATUS_LABELS[row.status]}
                >
                  <Dot row={row} />
                  <span>{row.slot.label}</span>
                  <span className={styles.count}>
                    {row.slot.unit === "lot"
                      ? row.lines.length
                        ? "In BOM"
                        : "Not in BOM"
                      : `${qty(row.filled)} / ${qty(row.required ?? 0)}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {coverage.other.length ? (
        <p className={styles.note}>
          {count(coverage.other.length)} BOM lines don&apos;t fill a slot; see them on the deployment.
        </p>
      ) : null}
    </section>
  );
}

/** The BOM lines filling a selected part's slots, for the rack elevation card. */
export function PartBom({ rows, vendors }: { rows: readonly SlotCoverage[]; vendors: Record<string, string> }): ReactElement {
  return (
    <div className={styles.part}>
      <p className={styles.eyebrow}>In the BOM</p>
      {rows.length ? (
        rows.map((row) => (
          <div key={row.slot.id}>
            <p className={styles.slot}>
              <Dot row={row} />
              <span>{row.slot.label}</span>
              <span className={styles.count}>
                {qty(row.filled)} / {qty(row.required ?? 0)}
              </span>
            </p>
            <ul className={styles.lines}>
              {row.lines.map((line) => (
                <li key={line.id}>
                  <strong>{(line.quoteItemId && vendors[line.quoteItemId]) || line.manufacturer || "Unquoted"}</strong>{" "}
                  {lineName(line)} × {qty(line.quantity)}
                  {line.unitUsd !== null
                    ? ` at ${formatCents(line.unitUsd)} = ${usd.format(lineUsd(line))}`
                    : " (included)"}
                </li>
              ))}
            </ul>
          </div>
        ))
      ) : (
        <p className={styles.note}>No slot stands for this part.</p>
      )}
    </div>
  );
}
