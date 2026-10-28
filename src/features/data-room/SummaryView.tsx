import { Fragment, type ReactElement, type ReactNode } from "react";
import Link from "next/link";
import { multiple, pct, usdShort } from "@/features/compute-model/format";
import { GPUS_PER_NODE, OPERATING_MONTHS } from "@/features/compute-model/model/inputs";
import { STATIC_MAP } from "@/features/deployments/places";
import {
  DILIGENCE_FIELDS,
  STATUS_LABELS,
  conversionUsd,
  criticalIt,
  summaryEconomics,
  toUsd,
  type AcquisitionTerms,
  type DiligenceItem,
  type DiligenceSource,
  type DiligenceStatus,
  type DiligenceSummary,
  type LeaseDeal,
  type LeaseEconomics,
  type LeaseTerms,
  type Money,
  type PurchaseEconomics,
  type SummaryEconomics,
} from "./summary";
import { CapitalStack, type CapitalSource, type Payout } from "./CapitalStack";
import { CopyButton } from "./CopyButton";
import { Icon } from "./icons";
import { siteMapSrc } from "./rooms";
import { SiteMap } from "./SiteMap";
import { googleMapsHref, type RoomSite } from "./types";
import styles from "./Summary.module.css";

type Summary = DiligenceSummary & { sourceNames: Map<string, string>; site: RoomSite | null };

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

/**
 * The diligence answers as plain text, in display order: each item's status,
 * headline and reasoning, then the files it cites by name and room path.
 */
function diligenceText(items: { label: string; item: DiligenceItem }[], names: Map<string, string>): string {
  const blocks = items.map(({ label, item }) => {
    const files = item.sources.map((source) => {
      const name = names.get(source.fileId);
      return name
        ? `- ${name} (${source.path})`
        : `- ${source.path.split("/").pop()} (${source.path}, no longer in the room)`;
    });
    return [
      `${label}: ${STATUS_LABELS[item.status]}`,
      item.headline,
      item.detail.replace(/\*\*(.+?)\*\*/g, "$1").trim(),
      files.length ? `Files:\n${files.join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });
  return ["Diligence", diligenceLede(items.map(({ item }) => item.status)), ...blocks].join("\n\n");
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

interface KeyFigure {
  label: string;
  value: string;
  estimate?: boolean;
}

/** Headline numbers in a grid, largest type on the page after the headings. */
function KeyFigures({ figures }: { figures: KeyFigure[] }) {
  return (
    <ul className={styles.keyFigures} data-count={figures.length}>
      {figures.map((f) => (
        <li key={f.label} className={styles.keyFigure}>
          <span className={styles.keyValue}>{f.value}</span>
          <span className={styles.keyLabel}>
            {f.label}
            {f.estimate ? <span className={styles.est}> · est.</span> : null}
          </span>
        </li>
      ))}
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

const perKwh = (usd: number) => `$${usd.toFixed(3)} / kWh`;

const mw = (n: number) => `${Number(n.toFixed(2))} MW`;

const HOURS_PER_MONTH = 8760 / 12;

/** Year 1 cost of one kWh of IT load: rent, operations and NNN spread over the month, plus utility power at the PUE. */
const allInPerKwh = (rent: LeaseTerms) =>
  (rent.baseLease + rent.operations + rent.nnn) / HOURS_PER_MONTH + rent.electricityRate * rent.pue;

const prepaidTotal = (deal: LeaseDeal) => deal.phases.reduce((total, p) => total + p.prepaidRent, 0);

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

/** "4 years", or "30 months" when the term isn't whole years. */
const contractTerm = (months: number) =>
  months % 12 === 0 ? plural(months / 12, "year", "years") : plural(months, "month", "months");

/** A source's share of the capital stack. */
const share = (amount: number, total: number) => (total > 0 ? `${pct(amount / total, 0)} of capital` : "");

/** "Nov 2026 to Jul 2027", or one month when both fall in it. */
const span = (from: number | null, to: number | null) =>
  from === null ? "" : to === null || monthYear(from) === monthYear(to) ? monthYear(from) : `${monthYear(from)} to ${monthYear(to)}`;

/** "Nov 2030 (4 years)": the month, then the years since `origin`. */
const dated = (ms: number, origin: number | null) => {
  if (origin === null) return monthYear(ms);
  const years = Number((Math.round((ms - origin) / (DAY * 30.4375)) / 12).toFixed(1));
  return `${monthYear(ms)} (${plural(years, "year", "years")})`;
};

/** `span` with the years since the first capital call beside each month. */
const yearSpan = (from: number | null, to: number | null, origin: number | null) =>
  from === null
    ? ""
    : to === null || monthYear(from) === monthYear(to)
      ? dated(from, origin)
      : `${dated(from, origin)} to ${dated(to, origin)}`;

const prefTerms = (i: SummaryEconomics["inputs"]) =>
  [
    `${pct(i.prefReturn, 0)} preferred return`,
    `${multiple(i.minMoic, 1)} minimum`,
    i.prefHoldMonths ? `paid out after ${contractTerm(i.prefHoldMonths)}` : "",
  ]
    .filter(Boolean)
    .join(", ");

/** What preferred and common take out of a deal, and over which months. */
function payouts(x: SummaryEconomics): Payout[] {
  const q = x.equity;
  return [
    {
      key: "pref",
      label: "Preferred equity",
      amount: q.prefOut,
      note: [
        q.prefMultiple === null ? "" : multiple(q.prefMultiple),
        `${irr(q.prefIrr)} IRR`,
        yearSpan(q.prefFirstOut, q.prefPaid, q.prefInFrom),
      ]
        .filter(Boolean)
        .join(" · "),
    },
    {
      key: "common",
      label: "Common",
      amount: q.commonOut,
      note: yearSpan(q.commonFrom, q.commonTo, q.prefInFrom),
    },
  ];
}

/** Every source of capital that enters a deal, equity first; the site loan splits into what it lends against. */
function capitalStack(x: SummaryEconomics): CapitalSource[] {
  const r = x.result;
  const i = x.inputs;
  const mortgage = i.sitePurchase * i.siteLtv;
  const siteTerms = `${pct(i.siteRate, 2)}, ${i.siteAmortizationYears}-yr amortization`;
  return [
    { key: "equity", label: "Preferred equity", amount: r.prefEquity, cost: prefTerms(i) },
    { key: "projectDebt", label: "Project debt", amount: r.siteLoan - mortgage, cost: `On conversion, ${siteTerms}` },
    { key: "mortgage", label: "Mortgage", amount: mortgage, cost: `On the purchase price, ${siteTerms}` },
    {
      key: "prepayment",
      label: "Customer prepayment",
      amount: r.prepayment,
      cost: `${pct(i.prepaymentShare, 0)} of contract value`,
    },
    { key: "gpu", label: "GPU financing", amount: r.loan, cost: `${pct(i.interestRate, 2)} over ${i.loanMonths} months` },
  ];
}

/**
 * A lease's capital, with no facility debt: equity pays the deposits, the rest
 * of the non-recurring charges and what the IT equipment needs beyond its GPU
 * financing and customer prepayment. Letters of credit and guaranties are
 * secured by others and stay off it.
 */
function leaseCapitalStack(x: SummaryEconomics, deal: LeaseDeal): CapitalSource[] {
  const r = x.result;
  const i = x.inputs;
  const charges = r.siteCost + r.prepaidRent;
  const deposits = Math.min(x.deposits, charges);
  const posted = deal.security.filter((s) => s.cash).map((s) => s.label.toLowerCase());
  return [
    {
      key: "deposits",
      label: "Deposits",
      amount: deposits,
      cost: `Equity: ${posted.join(" and ") || "cash deposits"} at signing, drawn first against the charges`,
    },
    {
      key: "charges",
      label: "Non-recurring charges",
      amount: charges - deposits,
      cost: "Equity: capital contribution and prepaid rent, less deposits",
    },
    { key: "itEquity", label: "IT equipment equity", amount: Math.max(0, r.prefEquity - charges), cost: `Equity: ${prefTerms(i)}` },
    {
      key: "prepayment",
      label: "Customer prepayment",
      amount: r.prepayment,
      cost: `${pct(i.prepaymentShare, 0)} of contract value`,
    },
    { key: "gpu", label: "GPU financing", amount: r.loan, cost: `${pct(i.interestRate, 2)} over ${i.loanMonths} months` },
  ];
}

/** Each source of capital with its share, then what preferred and common take out; payback counts from `from`. */
function capitalTerms(x: SummaryEconomics, capital: CapitalSource[], from: { at: number; label: string }): Term[] {
  const r = x.result;
  const q = x.equity;
  const total = capital.reduce((sum, c) => sum + c.amount, 0);
  const months = q.prefPayback === null ? null : Math.round((q.prefPayback - from.at) / (DAY * 30.4375));
  return [
    ...capital.map((c) => ({
      label: c.label,
      value: usdShort(c.amount),
      note: [share(c.amount, total), c.cost].filter(Boolean).join(" · "),
    })),
    { label: "Preferred IRR", value: irr(q.prefIrr), note: prefTerms(x.inputs) },
    {
      label: "Preferred multiple",
      value: q.prefMultiple === null ? "n.a." : multiple(q.prefMultiple),
      note: `${usdShort(q.prefIn)} paid in ${span(q.prefInFrom, q.prefInTo)}, ${usdShort(q.prefOut)} back`,
    },
    {
      label: "Preferred payback",
      value: q.prefPayback === null ? "Not reached" : monthYear(q.prefPayback),
      note: [
        months === null ? "" : `Capital back ${months} months from ${from.label}`,
        q.prefPaid === null ? "" : `paid in full ${monthYear(q.prefPaid)}`,
      ]
        .filter(Boolean)
        .join(", "),
    },
    {
      label: "Common distributions",
      value: usdShort(q.commonOut),
      note: yearSpan(q.commonFrom, q.commonTo, q.prefInFrom),
    },
    { label: "Project IRR", value: irr(r.projectIrr), note: "Before GPU debt" },
  ];
}

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
          value: contractTerm(i.contractMonths),
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
    { title: "Capital stack and IRR", terms: capitalTerms(x, capitalStack(x), { at: closing, label: "closing" }) },
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

  return <TermGroups id="deal" title="Deal terms" groups={groups} notes={notes} roomId={roomId} names={names} />;
}

/** Groups of label and value rows, with each figure's reasoning and sources behind a disclosure. */
function TermGroups({
  id,
  title,
  lede,
  groups,
  notes,
  roomId,
  names,
}: {
  id: string;
  title: string;
  lede?: string;
  groups: { title: string; terms: Term[] }[];
  notes: Figure[];
  roomId: string;
  names: Map<string, string>;
}) {
  return (
    <section className={styles.section} aria-labelledby={`${id}-heading`}>
      <div className={styles.sectionHead}>
        <h2 id={`${id}-heading`} className={styles.heading}>
          {title}
        </h2>
      </div>
      {lede ? <p className={styles.lede}>{lede}</p> : null}
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

/** A lease's headline terms: its phases, the security and non-recurring charges it asks for, its running rates and how it ends. */
function LeaseTermsSection({
  roomId,
  e,
  deal,
  x,
  names,
}: {
  roomId: string;
  e: LeaseEconomics;
  deal: LeaseDeal;
  x: SummaryEconomics;
  names: Map<string, string>;
}) {
  const { rent } = e;
  const full = deal.phases.at(-1);
  const capital = toUsd(e.capitalContribution, e.fx);
  const prepaid = prepaidTotal(deal);
  const pue = deal.pueCap ?? rent.pue;
  const escalation = `${pct(rent.leaseEscalation, 1)} / yr escalation`;
  const fullKw = (full?.itMw ?? 0) * 1000;
  const fullRent = rent.baseLease * fullKw;
  const fullRecurring = (rent.baseLease + rent.operations + rent.nnn) * fullKw;

  // Equity called before Phase 1 ships, then while each phase is the latest to ship.
  const { dates, prefContributions } = x.result.monthly;
  const ships = (x.phasing?.tranches ?? []).map((t) => t.shipMonth);
  const called = (from: number, to: number) => prefContributions.slice(from, to).reduce((total, v) => total + v, 0);
  const calls: Term[] = ships.length
    ? [
        {
          label: `Before ${deal.phases[0].name}`,
          value: usdShort(called(0, ships[0])),
          note: `From ${monthYear(dates[0])}: the capital contribution, legal costs and cash reserve`,
        },
        ...ships.map((ship, k) => ({
          label: `${deal.phases[k].name}, ${monthYear(dates[ship])}`,
          value: usdShort(called(ship, ships[k + 1] ?? dates.length)),
          note: `Prepaid rent and ${plural(x.phasing!.tranches[k].nodes, "node", "nodes")} beyond their financing and prepayment${
            k === ships.length - 1 ? ", with later top-ups" : ""
          }`,
        })),
      ]
    : [];

  const groups: { title: string; terms: Term[] }[] = [
    {
      title: "Headline terms",
      terms: [
        ...(full
          ? [
              {
                label: "Gross power",
                value: mw(full.grossMw),
                note: `${plural(deal.phases.length, "phase", "phases")} to ${monthYear(utcDate(full.targetDate))}`,
              },
              { label: "IT power", value: mw(full.itMw), note: "Rent is charged on each phase's IT power" },
            ]
          : []),
        {
          label: "Term",
          value: plural(deal.termYears, "year", "years"),
          note: `From the last phase, then ${deal.renewals.count} × ${deal.renewals.years}-year renewals`,
        },
        { label: "Base rent", value: perKwMonth(rent.baseLease), note: escalation },
        { label: "Rent at full build", value: `${usdShort(fullRent, 2)} / mo`, note: `${usdShort(fullRent * 12)} a year, before escalation` },
        {
          label: "All-in price per kWh",
          value: perKwh(allInPerKwh(rent)),
          note: "Per IT kWh in year 1: rent, operations, NNN and power",
          estimate: rent.estimate,
        },
        {
          label: "Non-recurring charges",
          value: capital === null ? "Not priced" : usdShort(capital + prepaid, 2),
          note: "Capital contribution and prepaid rent",
        },
      ],
    },
    {
      title: "Phases",
      terms: [
        ...deal.phases.map((p, i) => {
          const before = i > 0 ? deal.phases[i - 1].grossMw : 0;
          return {
            label: `${p.name}, ${longDate(utcDate(p.targetDate))}`,
            value: `${mw(p.itMw)} IT`,
            note: `${i > 0 ? `+${mw(p.grossMw - before)}, ` : ""}${mw(p.grossMw)} gross · ${usdShort(p.prepaidRent, 2)} prepaid rent`,
          };
        }),
        {
          label: "Prepaid rent credit",
          value: plural(deal.prepaidCreditMonths, "month", "months"),
          note: "Each payment is credited against base rent",
        },
      ],
    },
    {
      title: "Deposits and security",
      terms: deal.security.map((s) => ({
        label: s.label,
        value: s.amount === null ? "Open" : usdShort(s.amount),
        note: s.note,
      })),
    },
    {
      title: "Non-recurring charges",
      terms: [
        {
          label: "Capital contribution",
          value: capital === null ? "Not priced" : usdShort(capital, 2),
          note: `${plural(deal.capitalSchedule.length, "payment", "payments")}, not credited against rent`,
          estimate: e.capitalContribution.estimate,
        },
        ...deal.capitalSchedule.map((p) => ({
          label: p.trigger,
          value: usdShort(p.amount, 2),
          note: capital ? `${pct(p.amount / capital, 0)} of the capital contribution` : undefined,
        })),
        {
          label: "Prepaid rent",
          value: usdShort(prepaid, 2),
          note: `Paid as each phase is ready for service, credited over ${deal.prepaidCreditMonths} months`,
        },
      ],
    },
    {
      title: "Recurring charges",
      terms: [
        { label: "Base rent", value: perKwMonth(rent.baseLease), note: escalation },
        {
          label: "Operations fee",
          value: perKwMonth(rent.operations),
          note: deal.operationsTermYears ? `Fixed ${deal.operationsTermYears}-year term, ${escalation}` : escalation,
        },
        {
          label: "NNN",
          value: perKwMonth(rent.nnn),
          note: "Operating costs and taxes passed through",
          estimate: rent.estimate,
        },
        {
          label: "Electricity",
          value: perKwh(rent.electricityRate),
          note: deal.pueCap ? `At cost, PUE capped at ${pue.toFixed(2)}` : `At ${pue.toFixed(2)} PUE`,
          estimate: rent.estimate,
        },
        {
          label: "Power per IT kWh",
          value: perKwh(rent.electricityRate * pue),
          note: `The utility rate at ${pue.toFixed(2)} PUE`,
          estimate: rent.estimate,
        },
        {
          label: "Monthly at full build",
          value: `${usdShort(fullRecurring, 2)} / mo`,
          note: "Rent, operations and NNN, before power",
          estimate: rent.estimate,
        },
      ],
    },
    {
      title: "Capital stack and IRR",
      terms: capitalTerms(
        x,
        leaseCapitalStack(x, deal).filter((c) => c.amount > 0),
        { at: dates[0], label: "the first call" },
      ),
    },
    ...(calls.length ? [{ title: "Equity by phase", terms: calls }] : []),
    { title: "Exit and remedies", terms: deal.otherTerms },
  ];

  const notes: Figure[] = [
    {
      label: "Lease",
      value: plural(deal.termYears, "year", "years"),
      detail: deal.note,
      sources: deal.sources,
    },
  ];

  return (
    <TermGroups
      id="lease"
      title="Lease terms"
      lede={deal.status}
      groups={groups}
      notes={notes}
      roomId={roomId}
      names={names}
    />
  );
}

/** With lease terms, Economics summarizes the Lease terms section below it. */
function leaseKeyFigures(cluster: KeyFigure[], x: SummaryEconomics, e: LeaseEconomics, deal: LeaseDeal): KeyFigure[] {
  const r = x.result;
  const capital = toUsd(e.capitalContribution, e.fx);
  const deposit = deal.security.find((s) => s.amount !== null);
  const first = deal.phases[0];
  return [
    ...cluster,
    { label: `Annual revenue, ${mw(x.criticalItMw)} IT`, value: usdShort(x.fullBuildRevenue) },
    { label: "Base rent", value: perKwMonth(e.rent.baseLease) },
    { label: "All-in price per kWh", value: perKwh(allInPerKwh(e.rent)), estimate: e.rent.estimate },
    {
      label: "Non-recurring charges",
      value: capital === null ? "Not priced" : usdShort(capital + prepaidTotal(deal)),
      estimate: e.capitalContribution.estimate,
    },
    ...(deposit?.amount != null ? [{ label: deposit.label, value: usdShort(deposit.amount) }] : []),
    ...(first ? [{ label: `${first.name} target`, value: monthYear(utcDate(first.targetDate)) }] : []),
    {
      label: "Total project cost",
      value: usdShort(r.siteCost + r.prepaidRent + r.totalCapex),
      estimate: e.capitalContribution.estimate,
    },
    { label: "Equity capital", value: usdShort(r.prefEquity), estimate: e.rent.estimate },
  ];
}

/** Where the site is, linked to Google Maps, over a satellite preview when Maps is set up. */
function Site({ roomId, site }: { roomId: string; site: RoomSite }) {
  const href = googleMapsHref(site);
  const src = siteMapSrc(roomId, site);
  return (
    <section className={styles.section} aria-labelledby="site-heading">
      <div className={styles.sectionHead}>
        <h2 id="site-heading" className={styles.heading}>
          Site
        </h2>
        <a href={href} target="_blank" rel="noopener noreferrer" className={styles.modelLink}>
          Google Maps
          <Icon name="external" />
        </a>
      </div>
      <p className={styles.lede}>
        <a href={href} target="_blank" rel="noopener noreferrer" className={styles.siteAddress}>
          {site.address}
        </a>
      </p>
      {src ? (
        <SiteMap
          src={src}
          href={href}
          alt={`Satellite map of ${site.address}`}
          width={STATIC_MAP.width}
          height={STATIC_MAP.height}
        />
      ) : null}
    </section>
  );
}

/**
 * The deal at a glance: a line and four numbers from the standard compute
 * model, or eight summarizing the deal terms when the room has them, beside the
 * diligence answers, confirmed first; the deal terms follow in full. Every
 * figure's reasoning, the model's assumptions and each answer's sources sit
 * behind a disclosure.
 */
export function SummaryView({ roomId, summary }: { roomId: string; summary: Summary }): ReactElement {
  const e = summary.economics;
  const deal = summary.kind === "purchase" ? summary.economics.deal : undefined;
  const lease = summary.kind !== "purchase" ? summary.economics : undefined;
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
    ...(e.futurePower
      ? [
          {
            label: "Future potential",
            value: `${Number(e.futurePower.mw.toFixed(2))} MW`,
            note: "Facility power",
            detail: e.futurePower.note,
            estimate: e.futurePower.estimate,
            sources: e.futurePower.sources,
          },
        ]
      : []),
    {
      label: "B300 nodes",
      value: x.nodes.toLocaleString("en-US"),
      note: `${r.gpus.toLocaleString("en-US")} GPUs`,
      detail: `${r.gpus.toLocaleString("en-US")} GPUs at ${i.kwPerNode} kW of critical IT per node, ${usdShort(r.equipmentPurchase)} of equipment.`,
    },
    {
      label: "Revenue potential",
      value: `${usdShort(x.phasing ? x.fullBuildRevenue : r.year1Revenue)} / yr`,
      note: x.phasing ? `Net, all ${mw(x.criticalItMw)} of IT` : "Year 1 net",
      detail:
        (x.phasing
          ? `Net revenue over the first 12 months with all ${mw(x.criticalItMw)} of IT running, from ${monthYear(x.fullBuildFrom)}; ` +
            `${usdShort(r.year1Revenue)} in the first 12 months from ${lease?.deal?.phases[0].name ?? "the first phase"}, as the phases ramp. `
          : "Year 1 net revenue. ") +
        `${usdShort(x.lifetimeRevenue)} over ${OPERATING_MONTHS / 12} years of operation, ${usdShort(r.contractValue)} of it under the ${i.contractMonths}-month contract.`,
    },
  ];

  const fx = e.fx.currency === "USD" ? "" : ` ${e.fx.currency} converted at ${e.fx.usdPerUnit} USD (${e.fx.asOf}).`;
  const site =
    summary.kind !== "purchase"
      ? `${summary.kind === "colo" ? "Colo space" : "Site leased"}: base rent at $${i.baseLease} per kW-month escalating ${pct(i.leaseEscalation, 1)} a year, ` +
        `NNN and operations at $${i.nnn + i.operations} per kW-month, the capital contribution funded by equity and not recovered` +
        (x.phasing && lease?.deal
          ? `; the cluster ships in ${plural(x.phasing.tranches.length, "tranche", "tranches")} as each phase is ready for service, ` +
            `each paying its prepaid rent then, credited back over ${plural(lease.deal.prepaidCreditMonths, "month", "months")}, ` +
            `with the forecast starting ${monthYear(r.monthly.dates[0])} when ${lease.deal.phases[0].name}'s nodes are ordered. ` +
            `There's no facility debt; cash deposits are drawn first against the charges, and letters of credit and guaranties, secured by others, stay off the capital stack.`
          : ".")
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
  const cluster: KeyFigure[] = [
    { label: "B300 nodes", value: x.nodes.toLocaleString("en-US"), estimate: it.estimate },
    { label: "GPUs", value: r.gpus.toLocaleString("en-US"), estimate: it.estimate },
  ];
  const keyFigures: KeyFigure[] = deal
    ? [
        ...cluster,
        { label: "Annual revenue", value: usdShort(r.year1Revenue) },
        { label: "Annual net income", value: usdShort(r.year1NetProfit) },
        { label: "GPU price", value: `$${i.contractPrice.toFixed(2)} / hr`, estimate: deal.contract?.estimate ?? true },
        { label: "Contract term", value: contractTerm(i.contractMonths), estimate: deal.contract?.estimate ?? true },
        { label: "Total project cost", value: usdShort(r.siteCost + r.totalCapex), estimate: cost.estimate },
        { label: "Equity capital", value: usdShort(r.prefEquity), estimate: deal.financing.estimate },
      ]
    : lease?.deal
      ? leaseKeyFigures(cluster, x, lease, lease.deal)
      : [
        ...cluster,
        { label: "Revenue, year 1", value: usdShort(r.year1Revenue) },
        { label: "Upfront cost", value: cost.usd === null ? "Not priced" : usdShort(cost.usd), estimate: cost.estimate },
      ];
  const price = summary.kind === "purchase" ? toUsd(summary.economics.purchasePrice, summary.economics.fx) : null;
  const economicsLede = deal
    ? `${price === null ? "An unpriced" : `A ${usdShort(price)}`} acquisition of ${Number(deal.facilityPower.mw.toFixed(2))} MW closing ${longDate(
        utcDate(deal.closingDate),
      )}: ${plural(x.nodes, "B300 node", "B300 nodes")} after ${plural(deal.conversionMonths, "month", "months")} of conversion, ` +
      `revenue from ${monthYear(r.monthly.dates[r.firstOperatingMonth])}.`
    : lease?.deal?.phases.length
      ? `A ${lease.deal.termYears}-year ${summary.kind === "colo" ? "colo agreement" : "lease"} of ${mw(lease.deal.phases.at(-1)!.itMw)} IT in ` +
        `${plural(lease.deal.phases.length, "phase", "phases")} from ${monthYear(utcDate(lease.deal.phases[0].targetDate))}: ` +
        `${plural(x.nodes, "B300 node", "B300 nodes")} at full build, base case.`
      : `${plural(x.nodes, "B300 node", "B300 nodes")} on ${
        summary.kind === "purchase" ? "an owned" : summary.kind === "colo" ? "a colo" : "a leased"
      } site, base case.`;

  const powerFigures: KeyFigure[] = [
    {
      label: "Facility power",
      value: `${Number((deal ? deal.facilityPower.mw : (lease?.deal?.phases.at(-1)?.grossMw ?? x.criticalItMw * i.pue)).toFixed(2))} MW`,
      estimate: it.estimate,
    },
    { label: "IT power", value: `${Number(x.criticalItMw.toFixed(2))} MW`, estimate: it.estimate },
    ...(e.futurePower
      ? [
          {
            label: "Future potential",
            value: `${Number(e.futurePower.mw.toFixed(2))} MW`,
            estimate: e.futurePower.estimate,
          },
        ]
      : []),
  ];

  const items = DILIGENCE_FIELDS.flatMap(({ key, label }) => {
    const item = summary.diligence[key];
    return item ? [{ key, label, item }] : [];
  }).sort((a, b) => STATUS_ORDER.indexOf(a.item.status) - STATUS_ORDER.indexOf(b.item.status));

  return (
    <div className={styles.summary}>
      {summary.site ? <Site roomId={roomId} site={summary.site} /> : null}
      <div className={styles.columns}>
        <section className={styles.section} aria-labelledby="economics-heading">
          <div className={styles.sectionHead}>
            <h2 id="economics-heading" className={styles.heading}>
              Economics
            </h2>
            <a href={x.modelHref} target="_blank" rel="noopener noreferrer" className={styles.modelLink}>
              Compute model
              <Icon name="external" />
            </a>
          </div>
          <p className={styles.lede}>{economicsLede}</p>
          <KeyFigures figures={keyFigures} />
          {deal ? (
            <CapitalStack sources={capitalStack(x)} payouts={payouts(x)} />
          ) : lease?.deal ? (
            <CapitalStack sources={leaseCapitalStack(x, lease.deal)} payouts={payouts(x)} />
          ) : null}
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

        <div className={styles.stack}>
          <section className={styles.section} aria-labelledby="power-heading">
            <div className={styles.sectionHead}>
              <h2 id="power-heading" className={styles.heading}>
                Power
              </h2>
            </div>
            <KeyFigures figures={powerFigures} />
          </section>

          <section className={styles.section} aria-labelledby="diligence-heading">
            <div className={styles.sectionHead}>
              <h2 id="diligence-heading" className={styles.heading}>
                Diligence
              </h2>
              <CopyButton text={diligenceText(items, summary.sourceNames)} label="diligence" />
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
      {deal && summary.kind === "purchase" ? (
        <Deal roomId={roomId} e={summary.economics} deal={deal} x={x} names={summary.sourceNames} />
      ) : null}
      {lease?.deal ? (
        <LeaseTermsSection roomId={roomId} e={lease} deal={lease.deal} x={x} names={summary.sourceNames} />
      ) : null}
    </div>
  );
}
