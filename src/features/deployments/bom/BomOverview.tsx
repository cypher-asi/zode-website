"use client";

import { useMemo, useState, type ReactElement } from "react";
import Link from "next/link";
import { buildCluster } from "@/features/cluster/model/build";
import { GPUS_PER_NODE } from "@/features/cluster/model/catalog";
import { SLOT_SECTIONS, slotById } from "@/features/cluster/model/slots";
import ui from "@/features/data-room/ui.module.css";
import d from "../deployments.module.css";
import { formatCount, formatDay, formatUsd } from "../format";
import { platformLabel, type Deployment, type Phase } from "../types";
import { STATUS_LABELS, phaseCoverage, type SlotCoverage } from "./coverage";
import { phaseBuilderHref, phaseCluster, phaseLabel } from "./phase";
import { formatCents, lineUsd, quoteSections, quoteTotals, type Bom, type BomItem, type Quote } from "./types";
import styles from "./bom.module.css";

const fileHref = (roomId: string, fileId: string) => `/portal/data-rooms/${roomId}?file=${encodeURIComponent(fileId)}`;

const qty = (value: number) => formatCount(Math.round(value * 100) / 100);

export function Status({ row }: { row: Pick<SlotCoverage, "status" | "slot"> }): ReactElement {
  const optional = row.slot.optional && row.status === "missing";
  return (
    <span className={styles.status} data-status={row.status} data-optional={optional ? "" : undefined}>
      {optional ? "Not quoted (optional)" : STATUS_LABELS[row.status]}
    </span>
  );
}

/** Who a line came from and what it is, e.g. "Pegatron · AS402-2A1-8H2". */
const lineName = (item: BomItem, quotes: ReadonlyMap<string, Quote>) =>
  [item.quoteId ? quotes.get(item.quoteId)?.vendor : null, item.partNumber ?? item.description].filter(Boolean).join(" · ");

function QuoteCard({
  quote,
  bom,
  roomId,
  today,
}: {
  quote: Quote;
  bom: Bom;
  roomId: string | null;
  today: string;
}): ReactElement {
  const totals = quoteTotals(quote, bom.items);
  const lines = bom.items.filter((item) => item.quoteId === quote.id);
  const excluded = lines.filter((item) => item.status === "excluded").length;
  const expired = quote.validUntil !== null && quote.validUntil < today;
  return (
    <article className={styles.quote}>
      <div className={styles.head}>
        <h3 className={styles.quoteVendor}>{quote.vendor}</h3>
        {expired ? (
          <span className={styles.badge} data-tone="danger">
            Expired
          </span>
        ) : null}
      </div>
      <p className={styles.quoteMeta}>
        {[
          quote.reference ? `Quote ${quote.reference}` : null,
          quote.quotedOn ? formatDay(quote.quotedOn) : null,
          quote.validUntil ? `valid until ${formatDay(quote.validUntil)}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || "No reference"}
      </p>
      <dl className={styles.quoteFigures}>
        <div>
          <dt>Quoted total</dt>
          <dd>{formatCents(quote.quotedTotalUsd ?? totals.quotedUsd)}</dd>
        </div>
        <div>
          <dt>In this BOM</dt>
          <dd>{formatUsd(totals.bomUsd)}</dd>
        </div>
        <div>
          <dt>Lines</dt>
          <dd>
            {formatCount(lines.length)}
            {excluded ? <span className={styles.sub}>{formatCount(excluded)} excluded</span> : null}
          </dd>
        </div>
        <div>
          <dt>Lines vs. quote</dt>
          <dd>
            {totals.matches ? (
              <span className={styles.badge} data-tone="success">
                Match
              </span>
            ) : (
              <span className={styles.badge} data-tone="danger">
                Off by {formatCents(Math.abs(totals.quotedUsd - (quote.quotedTotalUsd ?? 0)))}
              </span>
            )}
          </dd>
        </div>
      </dl>
      {quote.dataRoomFileId && roomId ? (
        <Link className={d.link} href={fileHref(roomId, quote.dataRoomFileId)} prefetch={false}>
          {quote.dataRoomFileName}
        </Link>
      ) : (
        <p className={d.muted}>No file linked{roomId ? "" : ": link a data room to the deployment first"}.</p>
      )}
      {quote.notes ? <p className={styles.quoteMeta}>{quote.notes}</p> : null}
    </article>
  );
}

/** One quote as the vendor sent it, under its own section headings, with each line's slots or why it's left out. */
function FullQuote({ quote, bom }: { quote: Quote; bom: Bom }): ReactElement {
  const sections = quoteSections(quote.id, bom.items);
  const totals = quoteTotals(quote, bom.items);
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col" data-text="">
              Part #
            </th>
            <th scope="col" data-text="">
              Description
            </th>
            <th scope="col">Qty</th>
            <th scope="col">Unit</th>
            <th scope="col">Extended</th>
            <th scope="col" data-text="">
              Slot
            </th>
          </tr>
        </thead>
        {sections.map((section) => {
          const subtotal = section.items.reduce(
            (sum, item) => sum + lineUsd(item, item.quotedQuantity ?? item.quantity),
            0,
          );
          return (
            <tbody key={section.title}>
              <tr data-group="">
                <th colSpan={6}>{section.title || "Lines"}</th>
              </tr>
              {section.items.map((item) => {
                const quoted = item.quotedQuantity ?? item.quantity;
                return (
                  <tr
                    key={item.id}
                    data-excluded={item.status === "excluded" ? "" : undefined}
                    data-included={item.unitUsd === null ? "" : undefined}
                  >
                    <td data-text="" className={styles.part}>
                      {item.partNumber ?? "—"}
                    </td>
                    <td data-text="" data-strike="">
                      {item.description}
                      {item.leadTime ? <span className={styles.sub}>Lead time {item.leadTime}</span> : null}
                      {item.notes ? <span className={styles.sub}>{item.notes}</span> : null}
                    </td>
                    <td className={styles.nowrap}>
                      {qty(quoted)}
                      {item.quotedQuantity !== null && item.quotedQuantity !== item.quantity ? (
                        <span className={styles.sub}>{qty(item.quantity)} in BOM</span>
                      ) : null}
                    </td>
                    <td className={styles.nowrap}>{item.unitUsd === null ? "Included" : formatCents(item.unitUsd)}</td>
                    <td className={styles.nowrap}>{item.unitUsd === null ? "" : formatCents(lineUsd(item, quoted))}</td>
                    <td data-text="">
                      {item.status === "excluded" ? (
                        <span className={styles.sub}>Excluded: {item.excludedReason ?? "no reason given"}</span>
                      ) : item.fills.length ? (
                        <ul className={styles.lines}>
                          {item.fills.map((fill) => (
                            <li key={fill.slotId}>
                              {slotById(fill.slotId)?.label ?? fill.slotId}
                              {fill.unitsPerItem !== 1 ? ` × ${qty(fill.unitsPerItem)}` : ""}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className={styles.sub}>No slot</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr data-total="">
                <th colSpan={4} data-text="">
                  Subtotal
                </th>
                <td className={styles.nowrap}>{formatCents(subtotal)}</td>
                <td />
              </tr>
            </tbody>
          );
        })}
        <tbody>
          <tr data-total="">
            <th colSpan={4} data-text="">
              Quote total{quote.quotedTotalUsd !== null ? ` (stated ${formatCents(quote.quotedTotalUsd)})` : ""}
            </th>
            <td className={styles.nowrap}>{formatCents(totals.quotedUsd)}</td>
            <td />
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
  bom,
  quotes,
}: {
  deployment: Deployment;
  phase: Phase;
  index: number;
  bom: Bom;
  quotes: ReadonlyMap<string, Quote>;
}): ReactElement {
  const cluster = useMemo(() => phaseCluster(deployment, phase), [deployment, phase]);
  const items = useMemo(() => bom.items.filter((item) => item.phaseId === phase.id), [bom.items, phase.id]);
  const model = useMemo(() => (cluster ? buildCluster(cluster.config) : null), [cluster]);
  const coverage = useMemo(
    () => (model && cluster ? phaseCoverage(model, cluster.copies, items) : null),
    [model, cluster, items],
  );
  const title = `${phaseLabel(phase, index)} · ${formatCount(phase.nodes)} ${platformLabel(phase.platform)} nodes`;

  if (!cluster || !model || !coverage) {
    return (
      <section className={styles.phase} aria-label={title}>
        <h3 className={styles.phaseTitle}>{title}</h3>
        <p className={d.muted}>
          The cluster builder has no {platformLabel(phase.platform)} rack yet, so this phase has no slots to fill.
          {items.length ? ` ${formatCount(items.length)} lines are recorded against it.` : ""}
        </p>
      </section>
    );
  }

  const builderNodes = cluster.config.nodes * cluster.copies;
  const needed = coverage.slots.filter((row) => !row.slot.optional);
  const covered = needed.filter((row) => row.status === "covered" || row.status === "over").length;
  return (
    <section className={styles.phase} aria-label={title}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.phaseTitle}>{title}</h3>
          <p className={d.muted}>
            Checked against {cluster.copies > 1 ? `${cluster.copies} × ` : ""}a {formatCount(cluster.config.nodes)}-node
            cluster, {cluster.config.rackU}U racks of {cluster.config.density}
            {cluster.derived ? ", worked out from the phase" : ""}.
          </p>
        </div>
        <Link className={ui.button} href={phaseBuilderHref(deployment.id, phase.id)} prefetch={false}>
          Open in cluster builder
        </Link>
      </div>
      {builderNodes !== phase.nodes ? (
        <p className={styles.warn}>
          The builder&apos;s cluster has {formatCount(builderNodes)} nodes and the phase {formatCount(phase.nodes)}. Set
          the phase&apos;s cluster in the cluster builder.
        </p>
      ) : null}
      <div className={styles.figures}>
        <div className={styles.figure}>
          <span className={styles.figureValue}>{formatUsd(coverage.totalUsd)}</span>
          <span className={styles.figureLabel}>BOM total</span>
        </div>
        <div className={styles.figure}>
          <span className={styles.figureValue}>{formatUsd(coverage.totalUsd / builderNodes)}</span>
          <span className={styles.figureLabel}>Per node</span>
        </div>
        <div className={styles.figure}>
          <span className={styles.figureValue}>{formatUsd(coverage.totalUsd / (builderNodes * GPUS_PER_NODE))}</span>
          <span className={styles.figureLabel}>Per GPU</span>
        </div>
        <div className={styles.figure}>
          <span className={styles.figureValue}>
            {covered} of {needed.length}
          </span>
          <span className={styles.figureLabel}>
            Slots covered{coverage.gaps ? ` · ${coverage.gaps} to fill` : ""}
          </span>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" data-text="">
                Slot
              </th>
              <th scope="col">Needed</th>
              <th scope="col">Quoted</th>
              <th scope="col" data-text="">
                Status
              </th>
              <th scope="col" data-text="">
                Filled by
              </th>
            </tr>
          </thead>
          {SLOT_SECTIONS.map((section) => {
            const rows = coverage.slots.filter((row) => row.slot.section === section.id);
            if (!rows.length) return null;
            return (
              <tbody key={section.id}>
                <tr data-group="">
                  <th colSpan={4}>{section.label}</th>
                  <th className={styles.nowrap}>{formatUsd(coverage.sectionUsd.get(section.id) ?? 0)}</th>
                </tr>
                {rows.map((row) => (
                  <tr key={row.slot.id}>
                    <th scope="row" data-text="">
                      {row.slot.label}
                    </th>
                    <td>{row.slot.unit === "lot" ? "Lot" : qty(row.required)}</td>
                    <td>{row.slot.unit === "lot" ? (row.lines.length ? "Yes" : "—") : qty(row.filled)}</td>
                    <td data-text="">
                      <Status row={row} />
                    </td>
                    <td data-text="">
                      {row.lines.length ? (
                        <ul className={styles.lines}>
                          {row.lines.map(({ item, units }) => (
                            <li key={item.id}>
                              {lineName(item, quotes)} · {qty(units)}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            );
          })}
          {coverage.unslotted.length ? (
            <tbody>
              <tr data-group="">
                <th colSpan={4}>Not tied to a slot</th>
                <th className={styles.nowrap}>{formatUsd(coverage.sectionUsd.get("other") ?? 0)}</th>
              </tr>
              {coverage.unslotted.map((item) => (
                <tr key={item.id}>
                  <th scope="row" data-text="">
                    {lineName(item, quotes)}
                    {item.partNumber ? <span className={styles.sub}>{item.description}</span> : null}
                  </th>
                  <td />
                  <td>{qty(item.quantity)}</td>
                  <td data-text="">{item.unitUsd === null ? "Included" : formatUsd(lineUsd(item))}</td>
                  <td />
                </tr>
              ))}
            </tbody>
          ) : null}
        </table>
      </div>

      {coverage.excluded.length ? (
        <details>
          <summary className={d.muted}>{formatCount(coverage.excluded.length)} quoted lines left out</summary>
          <ul className={styles.lines}>
            {coverage.excluded.map((item) => (
              <li key={item.id}>
                {lineName(item, quotes)} × {qty(item.quantity)}: {item.excludedReason ?? "no reason given"}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

/**
 * The deployment's bill of materials for the ZODE team: its vendor quotes,
 * each phase's slot coverage against the cluster builder, and every quote in
 * full under its own headings.
 */
export function BomOverview({
  deployment,
  bom,
  today,
}: {
  deployment: Deployment;
  bom: Bom;
  today: string;
}): ReactElement {
  const [shown, setShown] = useState<string | null>(null);
  const quotes = useMemo(() => new Map(bom.quotes.map((quote) => [quote.id, quote])), [bom.quotes]);
  const open = shown ? quotes.get(shown) : null;
  const unphased = bom.items.filter((item) => !item.phaseId).length;

  return (
    <section className={d.block} aria-label="Bill of materials">
      <div className={styles.head}>
        <h2 className={d.blockTitle}>Bill of materials</h2>
        <Link className={ui.button} href={`/portal/deployments/${deployment.id}/bom`}>
          Edit BOM
        </Link>
      </div>

      {bom.quotes.length ? (
        <div className={styles.quotes}>
          {bom.quotes.map((quote) => (
            <QuoteCard key={quote.id} quote={quote} bom={bom} roomId={deployment.dataRoomId} today={today} />
          ))}
        </div>
      ) : (
        <p className={d.muted}>No quotes yet. Add them in the BOM editor, then fill each phase&apos;s slots.</p>
      )}

      {deployment.phases.map((phase, i) => (
        <PhaseBom key={phase.id} deployment={deployment} phase={phase} index={i} bom={bom} quotes={quotes} />
      ))}
      {unphased ? <p className={d.muted}>{formatCount(unphased)} lines aren&apos;t assigned to a phase.</p> : null}

      {bom.quotes.length ? (
        <section className={styles.phase} aria-label="Quotes in full">
          <h3 className={styles.phaseTitle}>Quotes in full</h3>
          <div className={styles.tabs}>
            {bom.quotes.map((quote) => (
              <button
                key={quote.id}
                type="button"
                className={styles.tab}
                aria-pressed={shown === quote.id}
                onClick={() => setShown(shown === quote.id ? null : quote.id)}
              >
                {quote.vendor}
              </button>
            ))}
          </div>
          {open ? <FullQuote quote={open} bom={bom} /> : null}
        </section>
      ) : null}
    </section>
  );
}
