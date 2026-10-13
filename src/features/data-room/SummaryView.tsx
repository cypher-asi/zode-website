import type { ReactElement } from "react";
import Link from "next/link";
import { pct, usdShort } from "@/features/compute-model/format";
import { GPUS_PER_NODE, OPERATING_MONTHS } from "@/features/compute-model/model/inputs";
import {
  DILIGENCE_FIELDS,
  STATUS_LABELS,
  summaryEconomics,
  toUsd,
  type DiligenceSource,
  type DiligenceStatus,
  type DiligenceSummary,
  type Money,
} from "./summary";
import { Icon } from "./icons";
import styles from "./Summary.module.css";

type Summary = DiligenceSummary & { sourceNames: Map<string, string> };

/** "CAD 31.5M"; USD keeps its dollar sign. */
const native = (amount: number, currency: string) =>
  currency === "USD" ? usdShort(amount) : usdShort(amount).replace("$", `${currency} `);

const irr = (n: number | null) => (n === null ? "n.a." : pct(n, 1));

const STATUS_ORDER: DiligenceStatus[] = ["confirmed", "claimed", "gap", "risk"];

const STATUS_MARKS: Record<DiligenceStatus, string> = {
  confirmed: "M4.75 8.25 7 10.5l4.25-5",
  claimed: "M6.1 6.3a1.95 1.95 0 1 1 2.75 1.8c-.5.25-.85.65-.85 1.2v.2M8 11.4h.01",
  gap: "M5.25 8h5.5",
  risk: "M8 4.75v3.75M8 11.25h.01",
};

function StatusMark({ status }: { status: DiligenceStatus }) {
  return (
    <svg viewBox="0 0 16 16" className={styles.mark} data-status={status} aria-hidden="true">
      <path d={STATUS_MARKS[status]} />
    </svg>
  );
}

function Sources({ roomId, sources, names }: { roomId: string; sources: DiligenceSource[]; names: Map<string, string> }) {
  if (!sources.length) return null;
  return (
    <ul className={styles.sources} aria-label="Sources">
      {sources.map((source) => {
        const name = names.get(source.fileId);
        return (
          <li key={source.fileId}>
            {name ? (
              <Link
                href={`/portal/data-rooms/${roomId}?file=${source.fileId}`}
                title={source.path}
                data-file-id={source.fileId}
              >
                {name}
              </Link>
            ) : (
              <span className={styles.gone} title="No longer in the room">
                {source.path.split("/").pop()}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

interface Figure {
  label: string;
  value: string;
  /** A few words under the label; the full reasoning is in `detail`. */
  note?: string;
  detail: string;
  estimate?: boolean;
  sources?: DiligenceSource[];
}

const moneyFigure = (label: string, money: Money, usd: number | null): Figure => ({
  label,
  value: usd === null ? "Not priced" : usdShort(usd),
  note: usd !== null && money.amount !== null && money.currency !== "USD" ? native(money.amount, money.currency) : undefined,
  detail: money.note,
  estimate: money.estimate,
  sources: money.sources,
});

const perKwMonth = (usd: number) => `$${Number(usd.toFixed(2))} / kW-mo`;

/** The figures that differ by deal: what a purchase pays for the site, or what a lease or colo costs. */
function siteFigures(summary: Summary): Figure[] {
  if (summary.kind !== "purchase") {
    const { rent, capitalContribution, fx } = summary.economics;
    return [
      {
        label: "Base rent",
        value: perKwMonth(rent.baseLease),
        note: `${pct(rent.leaseEscalation, 1)} / yr escalation`,
        detail: rent.note,
        estimate: rent.estimate,
        sources: rent.sources,
      },
      moneyFigure("Capital contribution", capitalContribution, toUsd(capitalContribution, fx)),
    ];
  }
  const { purchasePrice, conversionCost, fx } = summary.economics;
  return [
    moneyFigure("Purchase price", purchasePrice, toUsd(purchasePrice, fx)),
    moneyFigure("Conversion cost", conversionCost, toUsd(conversionCost, fx)),
  ];
}

/**
 * The site's economics from the standard compute model, as a purchase or a
 * lease by the room's kind, then the room's diligence answers as a checklist.
 * Each row opens to its reasoning and the room files it rests on.
 */
export function SummaryView({ roomId, summary }: { roomId: string; summary: Summary }): ReactElement {
  const e = summary.economics;
  const x = summaryEconomics(summary);
  const r = x.result;
  const i = x.inputs;

  const figures: Figure[] = [
    ...siteFigures(summary),
    {
      label: "Critical IT power",
      value: `${Number(x.criticalItMw.toFixed(2))} MW`,
      detail: e.criticalItMw.note,
      estimate: e.criticalItMw.estimate,
      sources: e.criticalItMw.sources,
    },
    {
      label: "B300 nodes",
      value: x.nodes.toLocaleString("en-US"),
      note: `${r.gpus.toLocaleString("en-US")} GPUs`,
      detail: `${r.gpus.toLocaleString("en-US")} GPUs at ${i.kwPerNode} kW of critical IT per node, ${usdShort(r.equipmentPurchase)} of equipment.`,
    },
    {
      label: "Revenue potential",
      value: `${usdShort(r.year1Revenue)} / yr`,
      note: "Year 1 net",
      detail: `Year 1 net revenue. ${usdShort(x.lifetimeRevenue)} over ${OPERATING_MONTHS / 12} years of operation, ${usdShort(r.contractValue)} of it under the ${i.contractMonths}-month contract.`,
    },
    {
      label: "IRR potential",
      value: irr(r.equityIrr),
      note: "Equity IRR",
      detail: `Equity IRR on ${usdShort(r.prefEquity)} of equity. Project IRR before GPU debt ${irr(r.projectIrr)}; preferred ${irr(r.prefIrr)}.`,
    },
  ];

  const fx = e.fx.currency === "USD" ? "" : ` ${e.fx.currency} converted at ${e.fx.usdPerUnit} USD (${e.fx.asOf}).`;
  const site =
    summary.kind !== "purchase"
      ? `${summary.kind === "colo" ? "Colo space" : "Site leased"}: base rent at $${i.baseLease} per kW-month escalating ${pct(i.leaseEscalation, 1)} a year, ` +
        `NNN and operations at $${i.nnn + i.operations} per kW-month, the capital contribution funded by equity and not recovered.`
      : `Site owned: purchase and conversion funded by equity, no base lease, ` +
        `NNN and operations at $${i.nnn + i.operations} per kW-month, ${pct(i.siteResidual, 0)} of the purchase price recovered at exit.`;
  const assumptions =
    `Standard compute model, base case: ${GPUS_PER_NODE}-GPU B300 nodes at ${usdShort(i.nodeCost * (1 + i.itShare))} with IT, ` +
    `$${i.contractPrice.toFixed(2)} per GPU-hour on a ${i.contractMonths}-month contract, PUE ${i.pue}, ` +
    `power at $${i.electricityRate.toFixed(3)} per kWh. ${site}${fx}`;

  const items = DILIGENCE_FIELDS.flatMap(({ key, label }) => {
    const item = summary.diligence[key];
    return item ? [{ key, label, item }] : [];
  });
  const tally = STATUS_ORDER.map((status) => ({
    status,
    count: items.filter(({ item }) => item.status === status).length,
  })).filter(({ count }) => count > 0);

  return (
    <div className={styles.summary}>
      <p className={styles.meta}>
        Confirmed answers rest on records in the room, claimed ones on the seller&apos;s word. Open a row for the
        reasoning and its sources.
      </p>

      <div className={styles.columns}>
        <section className={styles.section} aria-labelledby="economics-heading">
          <div className={styles.sectionHead}>
            <h2 id="economics-heading" className={styles.heading}>
              Economics
            </h2>
            <Link href={x.modelHref} className={styles.modelLink}>
              Open in compute model
            </Link>
          </div>
          <ul className={styles.list}>
            {figures.map((f) => (
              <li key={f.label}>
                <details className={styles.row}>
                  <summary className={`${styles.rowHead} ${styles.figureHead}`}>
                    <span className={styles.figureLabel}>
                      <span className={styles.rowLabel}>{f.label}</span>
                      {f.estimate ? <span className={styles.estimate}>Estimate</span> : null}
                      {f.note ? <span className={styles.figureNote}>{f.note}</span> : null}
                    </span>
                    <span className={styles.figureValue}>{f.value}</span>
                    <Icon name="chevron" className={styles.chevron} />
                  </summary>
                  <div className={`${styles.rowBody} ${styles.figureBody}`}>
                    <p className={styles.detail}>{f.detail}</p>
                    {f.sources?.length ? (
                      <Sources roomId={roomId} sources={f.sources} names={summary.sourceNames} />
                    ) : null}
                  </div>
                </details>
              </li>
            ))}
          </ul>
          <p className={styles.assumptions}>{assumptions} Planning estimates, not an offer or investment advice.</p>
        </section>

        <section className={styles.section} aria-labelledby="diligence-heading">
          <div className={styles.sectionHead}>
            <h2 id="diligence-heading" className={styles.heading}>
              Diligence
            </h2>
            <ul className={styles.tally} aria-label="Answers by status">
              {tally.map(({ status, count }) => (
                <li key={status} data-status={status}>
                  <StatusMark status={status} />
                  {count} {STATUS_LABELS[status].toLowerCase()}
                </li>
              ))}
            </ul>
          </div>
          <ul className={styles.list}>
            {items.map(({ key, label, item }) => (
              <li key={key}>
                <details className={styles.row}>
                  <summary className={styles.rowHead}>
                    <StatusMark status={item.status} />
                    <span className={styles.rowLabel}>{label}</span>
                    <span className={styles.rowText}>{item.headline}</span>
                    <span className={styles.status} data-status={item.status}>
                      {STATUS_LABELS[item.status]}
                    </span>
                    <Icon name="chevron" className={styles.chevron} />
                  </summary>
                  <div className={styles.rowBody}>
                    <p className={styles.detail}>{item.detail}</p>
                    <Sources roomId={roomId} sources={item.sources} names={summary.sourceNames} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
