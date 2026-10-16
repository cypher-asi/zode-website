"use client";

import { Fragment, useMemo, type ReactElement } from "react";
import Link from "next/link";
import { buildCluster } from "@/features/cluster/model/build";
import { GPUS_PER_NODE } from "@/features/cluster/model/catalog";
import { SLOT_SECTIONS } from "@/features/cluster/model/slots";
import ui from "@/features/data-room/ui.module.css";
import d from "../deployments.module.css";
import { TabLink } from "../DeploymentTabs";
import { formatCount, formatUsd, plural } from "../format";
import { platformLabel, type Deployment, type Phase } from "../types";
import { STATUS_LABELS, phaseCoverage, type SlotCoverage } from "./coverage";
import { phaseBuilderHref, phaseCluster, phaseLabel } from "./phase";
import { formatCents, lineUsd, type Bom, type BomLine, type Quote, type QuoteItem } from "./types";
import styles from "./bom.module.css";

export const qty = (value: number) => formatCount(Math.round(value * 100) / 100);

export function Status({ row }: { row: Pick<SlotCoverage, "status" | "slot"> }): ReactElement {
  const optional = row.slot.optional && row.status === "missing";
  return (
    <span className={styles.status} data-status={row.status} data-optional={optional ? "" : undefined}>
      {optional ? "Not in BOM (optional)" : STATUS_LABELS[row.status]}
    </span>
  );
}

/** What a slot needs against what its lines bring, e.g. "128 of 128". */
export function slotFill(row: Pick<SlotCoverage, "slot" | "required" | "filled" | "lines">): string {
  if (row.slot.unit === "lot") return row.lines.length ? "Lot" : "Lot, not in BOM";
  return row.required === null ? `${qty(row.filled)} in BOM` : `${qty(row.filled)} of ${qty(row.required)}`;
}

interface Lookup {
  items: ReadonlyMap<string, QuoteItem>;
  quotes: ReadonlyMap<string, Quote>;
}

const vendorOf = (line: BomLine, { items, quotes }: Lookup): string | null => {
  const item = line.quoteItemId ? items.get(line.quoteItemId) : undefined;
  return item ? (quotes.get(item.quoteId)?.vendor ?? null) : null;
};

function LineCells({ line, lookup }: { line: BomLine; lookup: Lookup }): ReactElement {
  const vendor = vendorOf(line, lookup);
  return (
    <>
      <td data-text="">
        {line.partNumber ? <span className={styles.part}>{line.partNumber}</span> : null}
        <span className={line.partNumber ? styles.sub : undefined}>{line.description}</span>
        {line.notes ? <span className={styles.sub}>{line.notes}</span> : null}
      </td>
      <td data-text="">
        {vendor ?? <span className={styles.sub}>Not from a quote</span>}
        {line.manufacturer && line.manufacturer !== vendor ? (
          <span className={styles.sub}>{line.manufacturer}</span>
        ) : null}
      </td>
      <td className={styles.nowrap}>{qty(line.quantity)}</td>
      <td className={styles.nowrap}>{line.unitUsd === null ? "Included" : formatCents(line.unitUsd)}</td>
      <td className={styles.nowrap}>{line.unitUsd === null ? "" : formatCents(lineUsd(line))}</td>
    </>
  );
}

/** The phase's BOM line by line, under the slot each fills, with every line's cost and the subtotals. */
function LineTable({
  slots,
  other,
  sectionUsd,
  totalUsd,
  lookup,
}: ReturnType<typeof phaseCoverage> & { lookup: Lookup }): ReactElement {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col" data-text="">
              Slot
            </th>
            <th scope="col" data-text="">
              Item
            </th>
            <th scope="col" data-text="">
              Vendor
            </th>
            <th scope="col">Qty</th>
            <th scope="col">Unit</th>
            <th scope="col">Line total</th>
          </tr>
        </thead>
        {SLOT_SECTIONS.map((section) => {
          const rows = slots.filter((row) => row.slot.section === section.id);
          if (!rows.length) return null;
          return (
            <tbody key={section.id}>
              <tr data-group="">
                <th colSpan={5}>{section.label}</th>
                <th className={styles.nowrap}>{formatUsd(sectionUsd.get(section.id) ?? 0)}</th>
              </tr>
              {rows.map((row) => {
                const head = (
                  <th scope="row" data-text="" rowSpan={Math.max(row.lines.length, 1)} className={styles.slotCell}>
                    {row.slot.label}
                    <span className={styles.sub}>{slotFill(row)}</span>
                    {row.status !== "unchecked" ? <Status row={row} /> : null}
                  </th>
                );
                if (!row.lines.length) {
                  return (
                    <tr key={row.slot.id} data-empty="">
                      {head}
                      <td data-text="" colSpan={5}>
                        <span className={styles.sub}>Nothing in this slot</span>
                      </td>
                    </tr>
                  );
                }
                return (
                  <Fragment key={row.slot.id}>
                    {row.lines.map((line, i) => (
                      <tr key={line.id} data-continued={i ? "" : undefined}>
                        {i === 0 ? head : null}
                        <LineCells line={line} lookup={lookup} />
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          );
        })}
        {other.length ? (
          <tbody>
            <tr data-group="">
              <th colSpan={5}>Other line items</th>
              <th className={styles.nowrap}>{formatUsd(sectionUsd.get("other") ?? 0)}</th>
            </tr>
            {other.map((line, i) => (
              <tr key={line.id} data-continued={i ? "" : undefined}>
                {i === 0 ? (
                  <th scope="row" data-text="" rowSpan={other.length} className={styles.slotCell}>
                    No slot
                  </th>
                ) : null}
                <LineCells line={line} lookup={lookup} />
              </tr>
            ))}
          </tbody>
        ) : null}
        <tbody>
          <tr data-total="">
            <th colSpan={5} data-text="">
              Phase total
            </th>
            <td className={styles.nowrap}>{formatCents(totalUsd)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PhaseBom({
  deployment,
  phase,
  index,
  lines,
  lookup,
}: {
  deployment: Deployment;
  phase: Phase;
  index: number;
  lines: readonly BomLine[];
  lookup: Lookup;
}): ReactElement {
  const cluster = useMemo(() => phaseCluster(deployment, phase), [deployment, phase]);
  const model = useMemo(() => (cluster ? buildCluster(cluster.config) : null), [cluster]);
  const coverage = useMemo(() => phaseCoverage(model, cluster?.copies ?? 1, lines), [model, cluster, lines]);
  const title = `${phaseLabel(phase, index)} · ${formatCount(phase.nodes)} ${platformLabel(phase.platform)} nodes`;
  const nodes = cluster ? cluster.config.nodes * cluster.copies : phase.nodes;
  const needed = coverage.slots.filter((row) => !row.slot.optional && row.required !== null && row.required > 0);
  const covered = needed.filter((row) => row.status === "covered" || row.status === "over").length;

  return (
    <section className={styles.phase} aria-label={title}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.phaseTitle}>{title}</h3>
          <p className={d.muted}>
            {cluster
              ? `Checked against ${cluster.copies > 1 ? `${cluster.copies} × ` : ""}a ${formatCount(cluster.config.nodes)}-node cluster, ${cluster.config.rackU}U racks of ${cluster.config.density}${cluster.derived ? ", worked out from the phase" : ""}.`
              : `The cluster builder has no ${platformLabel(phase.platform)} rack yet, so nothing checks what this phase needs.`}
          </p>
        </div>
        {cluster ? (
          <Link className={ui.button} href={phaseBuilderHref(deployment.id, phase.id)} prefetch={false}>
            Open in cluster builder
          </Link>
        ) : null}
      </div>
      {cluster && nodes !== phase.nodes ? (
        <p className={styles.warn}>
          The builder&apos;s cluster has {formatCount(nodes)} nodes and the phase {formatCount(phase.nodes)}. Set the
          phase&apos;s cluster in the cluster builder.
        </p>
      ) : null}
      {lines.length || cluster ? (
        <>
          <div className={styles.figures}>
            <div className={styles.figure}>
              <span className={styles.figureValue}>{formatUsd(coverage.totalUsd)}</span>
              <span className={styles.figureLabel}>BOM total · {plural(lines.length, "line")}</span>
            </div>
            <div className={styles.figure}>
              <span className={styles.figureValue}>{nodes ? formatUsd(coverage.totalUsd / nodes) : "—"}</span>
              <span className={styles.figureLabel}>Per node</span>
            </div>
            {cluster ? (
              <div className={styles.figure}>
                <span className={styles.figureValue}>{formatUsd(coverage.totalUsd / (nodes * GPUS_PER_NODE))}</span>
                <span className={styles.figureLabel}>Per GPU</span>
              </div>
            ) : null}
            {cluster ? (
              <div className={styles.figure}>
                <span className={styles.figureValue}>
                  {covered} of {needed.length}
                </span>
                <span className={styles.figureLabel}>
                  Slots covered{coverage.gaps ? ` · ${coverage.gaps} to fill` : ""}
                </span>
              </div>
            ) : null}
          </div>
          <LineTable {...coverage} lookup={lookup} />
        </>
      ) : (
        <p className={d.muted}>No BOM lines yet.</p>
      )}
    </section>
  );
}

/**
 * The deployment's bill of materials for the ZODE team: each phase line by
 * line under the cluster-builder slots, with what every line costs. The
 * quotes they're picked from have their own tab.
 */
export function BomOverview({ deployment, bom }: { deployment: Deployment; bom: Bom }): ReactElement {
  const lookup = useMemo<Lookup>(
    () => ({
      items: new Map(bom.items.map((item) => [item.id, item])),
      quotes: new Map(bom.quotes.map((quote) => [quote.id, quote])),
    }),
    [bom.items, bom.quotes],
  );
  const byPhase = useMemo(() => {
    const out = new Map<string, BomLine[]>();
    for (const line of bom.lines) out.set(line.phaseId, [...(out.get(line.phaseId) ?? []), line]);
    return out;
  }, [bom.lines]);
  const total = bom.lines.reduce((sum, line) => sum + lineUsd(line), 0);

  return (
    <section className={d.block} aria-label="Bill of materials">
      <div className={styles.head}>
        <h2 className={d.blockTitle}>
          Bill of materials{bom.lines.length ? ` · ${formatUsd(total)}` : ""}
        </h2>
        <Link className={ui.button} href={`/portal/deployments/${deployment.id}/bom/edit`}>
          Edit BOM
        </Link>
      </div>

      {deployment.phases.map((phase, i) => (
        <PhaseBom
          key={phase.id}
          deployment={deployment}
          phase={phase}
          index={i}
          lines={byPhase.get(phase.id) ?? []}
          lookup={lookup}
        />
      ))}

      <p className={d.muted}>
        Lines are picked from{" "}
        <TabLink tab="quotes" className={d.link}>
          {bom.quotes.length ? `the ${plural(bom.quotes.length, "quote")}` : "the quotes"}
        </TabLink>
        , whose part numbers, manufacturers and unit prices they copy.
      </p>
    </section>
  );
}
