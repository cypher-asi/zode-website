import type { ReactElement } from "react";
import Link from "next/link";
import { pct, usdShort } from "@/features/compute-model/format";
import { GPUS_PER_NODE, OPERATING_MONTHS } from "@/features/compute-model/model/inputs";
import {
  DILIGENCE_FIELDS,
  STATUS_LABELS,
  summaryEconomics,
  type DiligenceSource,
  type DiligenceSummary,
  type Money,
} from "./summary";
import styles from "./Summary.module.css";

type Summary = DiligenceSummary & { sourceNames: Map<string, string> };

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** "CAD 31.5M"; USD keeps its dollar sign. */
const native = (amount: number, currency: string) =>
  currency === "USD" ? usdShort(amount) : usdShort(amount).replace("$", `${currency} `);

const irr = (n: number | null) => (n === null ? "n.a." : pct(n, 1));

function Sources({ roomId, sources, names }: { roomId: string; sources: DiligenceSource[]; names: Map<string, string> }) {
  if (!sources.length) return null;
  return (
    <ul className={styles.sources} aria-label="Sources">
      {sources.map((source) => {
        const name = names.get(source.fileId);
        return (
          <li key={source.fileId}>
            {name ? (
              <Link href={`/portal/data-rooms/${roomId}/files?file=${source.fileId}`} title={source.path}>
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
  detail: string;
  estimate?: boolean;
  sources?: DiligenceSource[];
}

const moneyFigure = (label: string, money: Money, usd: number | null): Figure => ({
  label,
  value: usd === null ? "Not priced" : usdShort(usd),
  detail:
    usd !== null && money.amount !== null && money.currency !== "USD"
      ? `${native(money.amount, money.currency)}. ${money.note}`
      : money.note,
  estimate: money.estimate,
  sources: money.sources,
});

/**
 * A room's diligence answers, then the site's economics from the standard
 * compute model with the site owned. Each answer carries its evidence status
 * and links to the room files it rests on.
 */
export function SummaryView({ roomId, summary }: { roomId: string; summary: Summary | null }): ReactElement {
  if (!summary) {
    return (
      <div className={styles.empty}>
        <p>No diligence summary has been written for this room yet.</p>
        <Link href={`/portal/data-rooms/${roomId}/files`}>Browse the files</Link>
      </div>
    );
  }

  const e = summary.economics;
  const x = summaryEconomics(e);
  const r = x.result;
  const i = x.inputs;

  const figures: Figure[] = [
    moneyFigure("Purchase price", e.purchasePrice, x.purchaseUsd),
    moneyFigure("Conversion cost", e.conversionCost, x.conversionUsd),
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
      detail: `${r.gpus.toLocaleString("en-US")} GPUs at ${i.kwPerNode} kW of critical IT per node, ${usdShort(r.equipmentPurchase)} of equipment.`,
    },
    {
      label: "Revenue potential",
      value: `${usdShort(r.year1Revenue)} / yr`,
      detail: `Year 1 net revenue. ${usdShort(x.lifetimeRevenue)} over ${OPERATING_MONTHS / 12} years of operation, ${usdShort(r.contractValue)} of it under the ${i.contractMonths}-month contract.`,
    },
    {
      label: "IRR potential",
      value: irr(r.equityIrr),
      detail: `Equity IRR on ${usdShort(r.prefEquity)} of equity. Project IRR before GPU debt ${irr(r.projectIrr)}; preferred ${irr(r.prefIrr)}.`,
    },
  ];

  const fx = e.fx.currency === "USD" ? "" : ` ${e.fx.currency} converted at ${e.fx.usdPerUnit} USD (${e.fx.asOf}).`;
  const assumptions =
    `Standard compute model, base case: ${GPUS_PER_NODE}-GPU B300 nodes at ${usdShort(i.nodeCost * (1 + i.itShare))} with IT, ` +
    `$${i.contractPrice.toFixed(2)} per GPU-hour on a ${i.contractMonths}-month contract, PUE ${i.pue}, ` +
    `power at $${i.electricityRate.toFixed(3)} per kWh. Site owned: purchase and conversion funded by equity, no base lease, ` +
    `NNN and operations at $${i.nnn + i.operations} per kW-month, ${pct(i.siteResidual, 0)} of the purchase price recovered at exit.${fx}`;

  return (
    <div className={styles.summary}>
      <p className={styles.meta}>
        Diligence summary, updated {dateLabel(summary.updatedAt)}. Confirmed answers rest on records in the room, claimed
        ones on the seller&apos;s word.
      </p>

      <section className={styles.section} aria-labelledby="diligence-heading">
        <h2 id="diligence-heading" className={styles.heading}>
          Diligence
        </h2>
        <div className={styles.items}>
          {DILIGENCE_FIELDS.map(({ key, label }) => {
            const item = summary.diligence[key];
            if (!item) return null;
            return (
              <article key={key} className={styles.item}>
                <header className={styles.itemHead}>
                  <h3 className={styles.itemLabel}>{label}</h3>
                  <span className={styles.status} data-status={item.status}>
                    {STATUS_LABELS[item.status]}
                  </span>
                </header>
                <p className={styles.headline}>{item.headline}</p>
                <p className={styles.detail}>{item.detail}</p>
                <Sources roomId={roomId} sources={item.sources} names={summary.sourceNames} />
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="economics-heading">
        <div className={styles.sectionHead}>
          <h2 id="economics-heading" className={styles.heading}>
            Economics
          </h2>
          <Link href={x.modelHref} className={styles.modelLink}>
            Open in compute model
          </Link>
        </div>
        <dl className={styles.figures}>
          {figures.map((f) => (
            <div key={f.label} className={styles.figure}>
              <dt className={styles.figureLabel}>
                {f.label}
                {f.estimate ? <span className={styles.estimate}>Estimate</span> : null}
              </dt>
              <dd className={styles.figureValue}>{f.value}</dd>
              <dd className={styles.detail}>{f.detail}</dd>
              {f.sources?.length ? (
                <dd>
                  <Sources roomId={roomId} sources={f.sources} names={summary.sourceNames} />
                </dd>
              ) : null}
            </div>
          ))}
        </dl>
        <p className={styles.assumptions}>{assumptions} Planning estimates, not an offer or investment advice.</p>
      </section>
    </div>
  );
}
