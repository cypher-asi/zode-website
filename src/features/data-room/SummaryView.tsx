import { Fragment, type ReactElement, type ReactNode } from "react";
import Link from "next/link";
import { multiple, pct, usdShort } from "@/features/compute-model/format";
import { GPUS_PER_NODE, OPERATING_MONTHS } from "@/features/compute-model/model/inputs";
import {
  DILIGENCE_FIELDS,
  STATUS_LABELS,
  conversionUsd,
  criticalIt,
  summaryEconomics,
  toUsd,
  type AcquisitionTerms,
  type DiligenceSource,
  type DiligenceStatus,
  type DiligenceSummary,
  type Money,
  type PurchaseEconomics,
  type SummaryEconomics,
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
  const e = summary.economics;
  const conversion = moneyFigure("Conversion cost", e.conversionCost, conversionUsd(e, criticalIt(summary).value));
  if (e.conversionCost.perMw && e.conversionCost.amount !== null) {
    conversion.note = `${native(e.conversionCost.amount, e.conversionCost.currency)} / MW of critical IT`;
  }
  return [moneyFigure("Purchase price", e.purchasePrice, toUsd(e.purchasePrice, e.fx)), conversion];
}

/** What the site costs before it runs: price and conversion for a purchase, the capital contribution for a lease or colo. */
function upfront(summary: Summary): { usd: number | null; estimate: boolean } {
  if (summary.kind !== "purchase") {
    const { capitalContribution, fx } = summary.economics;
    return { usd: toUsd(capitalContribution, fx), estimate: capitalContribution.estimate };
  }
  const { purchasePrice, conversionCost, fx } = summary.economics;
  const price = toUsd(purchasePrice, fx);
  const conversion = conversionUsd(summary.economics, criticalIt(summary).value);
  return {
    usd: price === null || conversion === null ? null : price + conversion,
    estimate: purchasePrice.estimate || conversionCost.estimate,
  };
}

interface Term {
  label: string;
  value: string;
  note?: string;
  estimate?: boolean;
}

const DAY = 86_400_000;

const utcDate = (date: string) => Date.parse(`${date}T00:00:00Z`);

/** "Nov 30, 2026". */
const longDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** "Aug 2027". */
const monthYear = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

/** A source's share of the capital stack. */
const share = (amount: number, total: number) => (total > 0 ? `${pct(amount / total, 0)} of capital` : "");

/** The headline terms of an acquisition, its financing and what each source of capital funds, from the same model run as Economics. */
function Deal({
  roomId,
  e,
  deal,
  x,
  names,
}: {
  roomId: string;
  e: PurchaseEconomics;
  deal: AcquisitionTerms;
  x: SummaryEconomics;
  names: Map<string, string>;
}) {
  const r = x.result;
  const i = x.inputs;
  const power = deal.facilityPower;
  const financing = deal.financing;
  const price = toUsd(e.purchasePrice, e.fx);
  const deposit = toUsd(deal.deposit, e.fx);
  const conversion = conversionUsd(e, x.criticalItMw);
  // The model's own site basis, so down payment and loan add up to what it lends against.
  const basis = r.siteCost - i.sitePurchase * i.siteClosingCosts;
  const siteConversion = r.siteCost - i.sitePurchase * (1 + i.siteClosingCosts);
  const firstRevenue = r.monthly.dates[r.firstOperatingMonth];
  const closing = utcDate(deal.closingDate);
  const nativeNote = (money: Money) =>
    money.amount !== null && money.currency !== "USD" ? native(money.amount, money.currency) : undefined;

  const capital = [
    { label: "Equity capital", amount: r.prefEquity, cost: `${pct(i.prefReturn, 1)} preferred return` },
    { label: "Conversion debt", amount: r.siteLoan, cost: `${pct(i.siteRate, 2)}, ${i.siteAmortizationYears}-yr amortization` },
    {
      label: "Customer prepayment",
      amount: r.prepayment,
      cost: `${pct(i.prepaymentShare, 0)} of contract value`,
    },
    { label: "GPU debt", amount: r.loan, cost: `${pct(i.interestRate, 2)} over ${i.loanMonths} months` },
  ];
  const totalCapital = capital.reduce((total, c) => total + c.amount, 0);
  const months = x.paybackDate === null ? null : Math.round((x.paybackDate - closing) / (DAY * 30.4375));

  const groups: { title: string; terms: Term[] }[] = [
    {
      title: "Headline economics",
      terms: [
        { label: "Facility power", value: `${Number(power.mw.toFixed(2))} MW`, estimate: power.estimate },
        { label: "IT power", value: `${Number(x.criticalItMw.toFixed(2))} MW`, note: `At ${power.pue.toFixed(2)} PUE` },
        { label: "Platform", value: "NVIDIA B300", note: `${GPUS_PER_NODE}-GPU nodes at ${i.kwPerNode} kW` },
        { label: "Nodes", value: x.nodes.toLocaleString("en-US"), note: `${r.gpus.toLocaleString("en-US")} GPUs` },
        {
          label: "GPU price",
          value: `$${i.contractPrice.toFixed(2)} / GPU-hr`,
          note: "Contracted rate",
          estimate: deal.contract?.estimate ?? true,
        },
        {
          label: "Contract term",
          value: i.contractMonths % 12 === 0 ? plural(i.contractMonths / 12, "year", "years") : plural(i.contractMonths, "month", "months"),
          note: "Merchant rates after",
          estimate: deal.contract?.estimate ?? true,
        },
        { label: "Annual revenue", value: usdShort(r.year1Revenue), note: "Year 1 net revenue" },
        { label: "Annual EBITDA", value: usdShort(r.year1Ebitda), note: "Year 1, after SPV costs" },
        { label: "Annual net income", value: usdShort(r.year1NetProfit), note: "Year 1, after depreciation and interest" },
        {
          label: "Contract value",
          value: usdShort(r.contractValue),
          note: "Contracted revenue over the term",
        },
      ],
    },
    {
      title: "Acquisition and conversion",
      terms: [
        {
          label: "Purchase price",
          value: price === null ? "Not priced" : usdShort(price, 2),
          note: nativeNote(e.purchasePrice),
          estimate: e.purchasePrice.estimate,
        },
        {
          label: "Deposit",
          value: deposit === null ? "Not set" : usdShort(deposit),
          note: nativeNote(deal.deposit),
          estimate: deal.deposit.estimate,
        },
        {
          label: "Condition date",
          value: longDate(utcDate(deal.conditionDate)),
          note: `${plural(Math.round((closing - utcDate(deal.conditionDate)) / DAY), "day", "days")} before closing`,
        },
        { label: "Closing", value: longDate(closing), note: "The model's first month" },
        {
          label: "Conversion cost",
          value: conversion === null ? "Not priced" : usdShort(conversion),
          note:
            e.conversionCost.perMw && e.conversionCost.amount !== null
              ? `${native(e.conversionCost.amount, e.conversionCost.currency)} / MW of IT`
              : nativeNote(e.conversionCost),
          estimate: e.conversionCost.estimate,
        },
        {
          label: "Conversion timeline",
          value: plural(deal.conversionMonths, "month", "months"),
          note: `Revenue from ${monthYear(firstRevenue)}`,
        },
        {
          label: "Total project cost",
          value: usdShort(r.siteCost + r.totalCapex),
          note: `Purchase ${usdShort(r.siteCost - siteConversion)}, conversion ${usdShort(siteConversion)}, compute ${usdShort(r.totalCapex)}`,
        },
        {
          label: "Site value at exit",
          value: usdShort(i.sitePurchase * i.siteResidual * (1 - i.sellingCosts)),
          note: `${pct(i.siteResidual, 0)} of the price, after selling costs`,
        },
      ],
    },
    {
      title: "Financing structure",
      terms: [
        {
          label: "Down payment",
          value: usdShort(basis - r.siteLoan),
          note: `${pct(1 - financing.ltv, 0)} of price and conversion`,
        },
        {
          label: "Financed",
          value: usdShort(r.siteLoan),
          note: `${pct(financing.ltv, 0)} of price and conversion`,
          estimate: financing.estimate,
        },
        { label: "Monthly payment", value: usdShort(x.siteLoanPayment), note: "Principal and interest, from closing" },
        {
          label: "Terms",
          value: `${pct(financing.rate, 2)}, ${financing.amortizationYears} yr`,
          note: "Level payments, balance repaid at exit",
          estimate: financing.estimate,
        },
        {
          label: "Capital reserve",
          value: usdShort(x.capitalReserve),
          note: `${plural(financing.reserveMonths, "month", "months")} of payments, held to exit`,
          estimate: financing.estimate,
        },
        {
          label: "Payments during conversion",
          value: usdShort(x.siteLoanPayment * deal.conversionMonths),
          note: "Before revenue starts",
        },
      ],
    },
    {
      title: "Capital stack and IRR",
      terms: [
        ...capital.map((c) => ({
          label: c.label,
          value: usdShort(c.amount),
          note: [share(c.amount, totalCapital), c.cost].filter(Boolean).join(" · "),
        })),
        { label: "Equity IRR", value: irr(r.equityIrr), note: `On ${usdShort(r.prefEquity)} of equity` },
        { label: "Project IRR", value: irr(r.projectIrr), note: "Before GPU debt" },
        {
          label: "Equity multiple",
          value: x.equityMultiple === null ? "n.a." : multiple(x.equityMultiple),
          note: "All distributions over equity",
        },
        {
          label: "Payback",
          value: x.paybackDate === null ? "Not reached" : monthYear(x.paybackDate),
          note: months === null ? undefined : `${months} months from closing`,
        },
      ],
    },
  ];

  const notes: Figure[] = [
    {
      label: "Facility power",
      value: `${Number(power.mw.toFixed(2))} MW`,
      detail: power.note,
      estimate: power.estimate,
      sources: power.sources,
    },
    ...(deal.contract
      ? [
          {
            label: "GPU contract",
            value: `$${deal.contract.pricePerGpuHour.toFixed(2)} / GPU-hr`,
            note: plural(deal.contract.months, "month", "months"),
            detail: deal.contract.note,
            estimate: deal.contract.estimate,
            sources: deal.contract.sources,
          },
        ]
      : []),
    moneyFigure("Deposit", deal.deposit, deposit),
    {
      label: "Financing",
      value: `${pct(financing.ltv, 0)} financed`,
      detail: financing.note,
      estimate: financing.estimate,
      sources: financing.sources,
    },
  ];

  return (
    <section className={styles.section} aria-labelledby="deal-heading">
      <div className={styles.sectionHead}>
        <h2 id="deal-heading" className={styles.heading}>
          Deal terms
        </h2>
      </div>
      <div className={styles.dealGroups}>
        {groups.map((group) => (
          <div key={group.title} className={styles.dealGroup}>
            <h3 className={styles.groupHeading}>{group.title}</h3>
            <dl className={styles.terms}>
              {group.terms.map((t) => (
                <div key={t.label} className={styles.term}>
                  <dt className={styles.termLabel}>
                    <span>
                      {t.label}
                      {t.estimate ? <span className={styles.est}> · est.</span> : null}
                    </span>
                    {t.note ? <span className={styles.termNote}>{t.note}</span> : null}
                  </dt>
                  <dd className={styles.termValue}>{t.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      <details className={styles.more}>
        <summary className={styles.moreHead}>
          Terms and sources
          <Icon name="chevron" className={styles.chevron} />
        </summary>
        <ul className={styles.figures}>
          {notes.map((f) => (
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
              {f.sources?.length ? <Sources roomId={roomId} sources={f.sources} names={names} /> : null}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

/**
 * The deal at a glance: a line and four numbers from the standard compute
 * model, or six summarizing the deal terms when the room has them, beside the
 * diligence answers, confirmed first; the deal terms follow in full. Every
 * figure's reasoning, the model's assumptions and each answer's sources sit
 * behind a disclosure.
 */
export function SummaryView({ roomId, summary }: { roomId: string; summary: Summary }): ReactElement {
  const e = summary.economics;
  const deal = summary.kind === "purchase" ? summary.economics.deal : undefined;
  const it = criticalIt(summary);
  const x = summaryEconomics(summary);
  const r = x.result;
  const i = x.inputs;

  const figures: Figure[] = [
    ...siteFigures(summary),
    {
      label: "Critical IT power",
      value: `${Number(x.criticalItMw.toFixed(2))} MW`,
      note: deal ? `${Number(deal.facilityPower.mw.toFixed(2))} MW facility at ${deal.facilityPower.pue.toFixed(2)} PUE` : undefined,
      detail: it.note,
      estimate: it.estimate,
      sources: it.sources,
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
      : deal
        ? `Site owned: bought and converted from closing on ${longDate(utcDate(deal.closingDate))}, the cluster shipping after ${plural(deal.conversionMonths, "month", "months")} of conversion; ` +
          `${pct(i.siteLtv, 0)} of purchase and conversion on a bank loan at ${pct(i.siteRate, 2)} over ${i.siteAmortizationYears} years with a ${pct(i.siteLoanFee, 1)} fee, ` +
          `the rest and ${plural(deal.financing.reserveMonths, "month", "months")} of loan payments in reserve funded by equity; no base lease, ` +
          `NNN and operations at $${i.nnn + i.operations} per kW-month, ${pct(i.siteResidual, 0)} of the purchase price recovered at exit.`
        : `Site owned: purchase and conversion funded by equity, no base lease, ` +
          `NNN and operations at $${i.nnn + i.operations} per kW-month, ${pct(i.siteResidual, 0)} of the purchase price recovered at exit.`;
  const assumptions =
    `Standard compute model, base case: ${GPUS_PER_NODE}-GPU B300 nodes at ${usdShort(i.nodeCost * (1 + i.itShare))} with IT, ` +
    `$${i.contractPrice.toFixed(2)} per GPU-hour on a ${i.contractMonths}-month contract, PUE ${i.pue}, ` +
    `power at $${i.electricityRate.toFixed(3)} per kWh. ${site}${fx}`;

  const cost = upfront(summary);
  // With deal terms, Economics summarizes the Deal section below it: one figure or two from each group.
  const keyFigures = deal
    ? [
        { label: "Equity IRR", value: irr(r.equityIrr) },
        { label: "Equity multiple", value: x.equityMultiple === null ? "n.a." : multiple(x.equityMultiple) },
        { label: "Annual revenue", value: usdShort(r.year1Revenue) },
        { label: "Annual net income", value: usdShort(r.year1NetProfit) },
        { label: "Total project cost", value: usdShort(r.siteCost + r.totalCapex), estimate: cost.estimate },
        { label: "Equity capital", value: usdShort(r.prefEquity), estimate: deal.financing.estimate },
      ]
    : [
        { label: "Equity IRR", value: irr(r.equityIrr) },
        { label: "Revenue, year 1", value: usdShort(r.year1Revenue) },
        { label: "Upfront cost", value: cost.usd === null ? "Not priced" : usdShort(cost.usd), estimate: cost.estimate },
        { label: "Critical IT", value: `${Number(x.criticalItMw.toFixed(2))} MW`, estimate: it.estimate },
      ];
  const price = summary.kind === "purchase" ? toUsd(summary.economics.purchasePrice, summary.economics.fx) : null;
  const economicsLede = deal
    ? `${price === null ? "An unpriced" : `A ${usdShort(price)}`} acquisition of ${Number(deal.facilityPower.mw.toFixed(2))} MW closing ${longDate(
        utcDate(deal.closingDate),
      )}: ${plural(x.nodes, "B300 node", "B300 nodes")} after ${plural(deal.conversionMonths, "month", "months")} of conversion, ` +
      `revenue from ${monthYear(r.monthly.dates[r.firstOperatingMonth])}.`
    : `${plural(x.nodes, "B300 node", "B300 nodes")} on ${
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
      {deal && summary.kind === "purchase" ? (
        <Deal roomId={roomId} e={summary.economics} deal={deal} x={x} names={summary.sourceNames} />
      ) : null}
    </div>
  );
}
