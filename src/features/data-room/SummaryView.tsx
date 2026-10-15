import { Fragment, type ReactElement, type ReactNode } from "react";
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

/** Diligence rows lead with what the room confirms. */
const STATUS_ORDER: DiligenceStatus[] = ["confirmed", "claimed", "gap", "risk"];

const STATUS_HINTS: Record<DiligenceStatus, string> = {
  confirmed: "Rests on records in the room",
  claimed: "On the seller's word",
  gap: "Nothing in the room either way",
  risk: "A known concern",
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "3 of 8 confirmed. 3 risks and 2 gaps to resolve." */
function diligenceLede(statuses: DiligenceStatus[]): string {
  const count = (status: DiligenceStatus) => statuses.filter((s) => s === status).length;
  const confirmed = count("confirmed");
  if (confirmed === statuses.length) return `All ${statuses.length} confirmed.`;
  const open = [
    count("risk") && plural(count("risk"), "risk", "risks"),
    count("gap") && plural(count("gap"), "gap", "gaps"),
  ].filter(Boolean);
  const claimed = count("claimed");
  return [
    `${confirmed} of ${statuses.length} confirmed.`,
    open.length ? `${open.join(" and ")} to resolve.` : "",
    claimed ? `${claimed} on the seller's word.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** `**bold**` spans; everything else stays plain text. */
function inline(text: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));
}

/**
 * A summary's reasoning: blank lines separate paragraphs, and lines starting
 * with "- " form a list, optionally under a lead-in line.
 */
function Prose({ text }: { text: string }) {
  const blocks = text
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .filter((lines) => lines.length);
  return (
    <div className={styles.detail}>
      {blocks.map((lines, i) => {
        const isItem = (line: string) => line.startsWith("- ");
        const lead = isItem(lines[0]) ? null : lines[0];
        const rest = lead === null ? lines : lines.slice(1);
        if (!rest.length || !rest.every(isItem)) return <p key={i}>{inline(lines.join(" "))}</p>;
        return (
          <Fragment key={i}>
            {lead === null ? null : <p>{inline(lead)}</p>}
            <ul>
              {rest.map((line, j) => (
                <li key={j}>{inline(line.slice(2))}</li>
              ))}
            </ul>
          </Fragment>
        );
      })}
    </div>
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

/** What the site costs before it runs: price and conversion for a purchase, the capital contribution for a lease or colo. */
function upfront(summary: Summary): { usd: number | null; estimate: boolean } {
  if (summary.kind !== "purchase") {
    const { capitalContribution, fx } = summary.economics;
    return { usd: toUsd(capitalContribution, fx), estimate: capitalContribution.estimate };
  }
  const { purchasePrice, conversionCost, fx } = summary.economics;
  const price = toUsd(purchasePrice, fx);
  const conversion = toUsd(conversionCost, fx);
  return {
    usd: price === null || conversion === null ? null : price + conversion,
    estimate: purchasePrice.estimate || conversionCost.estimate,
  };
}

/**
 * The deal at a glance: a line and four numbers from the standard compute
 * model, then the diligence answers, confirmed first. Every figure's reasoning,
 * the model's assumptions and each answer's sources sit behind a disclosure.
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

  const cost = upfront(summary);
  const keyFigures = [
    { label: "Equity IRR", value: irr(r.equityIrr) },
    { label: "Revenue, year 1", value: usdShort(r.year1Revenue) },
    { label: "Upfront cost", value: cost.usd === null ? "Not priced" : usdShort(cost.usd), estimate: cost.estimate },
    { label: "Critical IT", value: `${Number(x.criticalItMw.toFixed(2))} MW`, estimate: e.criticalItMw.estimate },
  ];
  const economicsLede = `${plural(x.nodes, "B300 node", "B300 nodes")} on ${
    summary.kind === "purchase" ? "an owned" : summary.kind === "colo" ? "a colo" : "a leased"
  } site, base case.`;

  const items = DILIGENCE_FIELDS.flatMap(({ key, label }) => {
    const item = summary.diligence[key];
    return item ? [{ key, label, item }] : [];
  }).sort((a, b) => STATUS_ORDER.indexOf(a.item.status) - STATUS_ORDER.indexOf(b.item.status));

  return (
    <div className={styles.summary}>
      <div className={styles.columns}>
        <section className={styles.section} aria-labelledby="economics-heading">
          <div className={styles.sectionHead}>
            <h2 id="economics-heading" className={styles.heading}>
              Economics
            </h2>
            <Link href={x.modelHref} className={styles.modelLink}>
              Compute model
            </Link>
          </div>
          <p className={styles.lede}>{economicsLede}</p>
          <ul className={styles.keyFigures}>
            {keyFigures.map((f) => (
              <li key={f.label} className={styles.keyFigure}>
                <span className={styles.keyValue}>{f.value}</span>
                <span className={styles.keyLabel}>
                  {f.label}
                  {f.estimate ? <span className={styles.est}> · est.</span> : null}
                </span>
              </li>
            ))}
          </ul>
          <details className={styles.more}>
            <summary className={styles.moreHead}>
              Figures and assumptions
              <Icon name="chevron" className={styles.chevron} />
            </summary>
            <ul className={styles.figures}>
              {figures.map((f) => (
                <li key={f.label} className={styles.figure}>
                  <div className={styles.figureHead}>
                    <span className={styles.figureLabel}>
                      {f.label}
                      {f.estimate ? <span className={styles.estimate}>Estimate</span> : null}
                      {f.note ? <span className={styles.figureNote}>{f.note}</span> : null}
                    </span>
                    <span className={styles.figureValue}>{f.value}</span>
                  </div>
                  <Prose text={f.detail} />
                  {f.sources?.length ? (
                    <Sources roomId={roomId} sources={f.sources} names={summary.sourceNames} />
                  ) : null}
                </li>
              ))}
            </ul>
            <p className={styles.assumptions}>{assumptions} Planning estimates, not an offer or investment advice.</p>
          </details>
        </section>

        <section className={styles.section} aria-labelledby="diligence-heading">
          <div className={styles.sectionHead}>
            <h2 id="diligence-heading" className={styles.heading}>
              Diligence
            </h2>
          </div>
          <p className={styles.lede}>{diligenceLede(items.map(({ item }) => item.status))}</p>
          <ul className={styles.list}>
            {items.map(({ key, label, item }) => (
              <li key={key}>
                <details className={styles.row}>
                  <summary className={styles.rowHead}>
                    <span className={styles.dot} data-status={item.status} aria-hidden="true" />
                    <span className={styles.rowLabel}>{label}</span>
                    <span className={styles.status} data-status={item.status} title={STATUS_HINTS[item.status]}>
                      {STATUS_LABELS[item.status]}
                    </span>
                    <Icon name="chevron" className={styles.chevron} />
                  </summary>
                  <div className={styles.rowBody}>
                    <p className={styles.headline}>{item.headline}</p>
                    <Prose text={item.detail} />
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
