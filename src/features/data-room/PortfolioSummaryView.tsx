import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import { multiple, pct, usdShort } from "@/features/compute-model/format";
import { GPUS_PER_NODE } from "@/features/compute-model/model/inputs";
import { CapitalStack, type CapitalSource, type Payout } from "./CapitalStack";
import { Icon } from "./icons";
import type { CaseFormat, InvestorReturns, PortfolioMetrics, PortfolioModel, PortfolioSite, TermSet } from "./portfolio";
import type { PortfolioSummary } from "./summary";
import {
  KeyFigures,
  plural,
  TermGroup,
  type KeyFigure,
  type Term,
} from "./SummaryParts";
import styles from "./Summary.module.css";
import p from "./Portfolio.module.css";

/** "Oct 2027". */
const monthYear = (date: string | null) =>
  date === null
    ? "n.a."
    : new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

const mw = (n: number) => `${Number(n.toFixed(2))} MW`;
const orNa = (n: number | null, f: (n: number) => string) => (n === null ? "n.a." : f(n));
const irr = (n: number | null) => orNa(n, (v) => pct(v, 1));
const times = (n: number | null) => orNa(n, (v) => multiple(v));
const returns = (rate: number | null, x: number | null) => `${irr(rate)} · ${times(x)}`;
const andList = (names: string[]) =>
  names.length < 3 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

/** "Sale exit about 21 months after..." as a sentence of its own. */
const sentence = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}${/[.!?]$/.test(text) ? "" : "."}`;

const caseValue = (format: CaseFormat, n: number, digits = 1) => {
  switch (format) {
    case "months":
      return plural(n, "month", "months");
    case "usd":
      return usdShort(n);
    case "usdPerMw":
      return `${usdShort(n, 2)} / MW`;
    case "kwMonth":
      return `$${n} / kW-mo`;
    case "gpuHour":
      return `$${n.toFixed(2)} / GPU-hr`;
    case "pct":
      return pct(n, digits);
    case "x":
      return multiple(n);
    case "mw":
      return mw(n);
  }
};

/** "12% compounding pref, 95/5 with ZODE": what a class of equity is paid first. */
const prefLine = (t: TermSet) =>
  [
    `${pct(t.prefReturn, 1)} ${t.compounds ? "compounding" : "simple"} pref`,
    t.minMultiple > 1 ? `${multiple(t.minMultiple, 1)} minimum` : "",
    t.investorShare < 1 ? `${Math.round(t.investorShare * 100)}/${Math.round((1 - t.investorShare) * 100)} with ZODE` : "",
  ]
    .filter(Boolean)
    .join(", ");

/** "Then 70% of the cash to 2.0x, then 50%": the investors' share once the pref is paid. */
const tiersLine = (t: TermSet) =>
  t.tier1Until >= 99 || t.tier1Share === t.tier2Share
    ? `Then ${pct(t.tier1Share, 0)} of the cash`
    : `Then ${pct(t.tier1Share, 0)} of the cash to ${multiple(t.tier1Until, 1)}, then ${pct(t.tier2Share, 0)}`;

/** Links that open in the room's browser: a folder, or the summary in it. */
function FolderLink({
  roomId,
  folderId,
  summary = false,
  children,
}: {
  roomId: string;
  folderId: string;
  summary?: boolean;
  children: ReactNode;
}): ReactElement {
  return (
    <Link
      href={`/portal/data-rooms/${roomId}?folder=${folderId}${summary ? "&summary=1" : ""}`}
      data-folder-id={folderId}
      data-summary={summary ? "" : undefined}
    >
      {children}
    </Link>
  );
}

/** Each source of construction-period capital, equity first. */
function capitalStack(m: PortfolioModel): CapitalSource[] {
  const { sources } = m.sourcesAndUses;
  const { site, compute } = m.investors;
  const t = m.terms;
  return [
    { key: "siteEquity", label: "Site equity", amount: sources.siteEquity, cost: `${site.terms.name}: ${prefLine(site.terms)}` },
    {
      key: "computeEquity",
      label: "Compute equity",
      amount: sources.computeEquity,
      cost: `${compute.terms.name}: ${prefLine(compute.terms)}`,
    },
    {
      key: "reDebt",
      label: "Real estate debt",
      amount: sources.reDebt,
      cost: `${pct(t.acquisitionLoan, 0)} of price, ${pct(t.constructionLoan, 0)} of contracted conversion, at ${pct(t.reRate, 1)}`,
    },
    {
      key: "prepayment",
      label: "Customer prepayment",
      amount: sources.prepayments,
      cost: `${pct(t.prepaymentShare, 1)} of contract value, at GPU order`,
    },
    {
      key: "gpu",
      label: "GPU debt",
      amount: sources.gpuDebt,
      cost: `${pct(t.gpuRate, 1)}, sized to ${multiple(t.gpuDscr)} DSCR, up to ${pct(t.gpuMaxLtc, 0)} of cost`,
    },
    {
      key: "operating",
      label: "Operating cash flow",
      amount: sources.operating + sources.other,
      cost: "From blocks already running",
    },
  ];
}

function payouts(m: PortfolioModel): Payout[] {
  const line = (r: InvestorReturns) => `${returns(r.irr, r.multiple)} on ${usdShort(r.capital)} in`;
  return [
    { key: "site", label: "Site investors", amount: m.investors.site.received, note: line(m.investors.site) },
    { key: "compute", label: "Compute investors", amount: m.investors.compute.received, note: line(m.investors.compute) },
  ];
}

interface MetricRow {
  label: string;
  value: (m: PortfolioMetrics) => string;
}

/** The workbook's MW are facility power, so IT load is each over the model's PUE. */
const metricGroups = (pue: number): { title: string; rows: MetricRow[] }[] => [
  {
    title: "Capacity",
    rows: [
      { label: "Facility power", value: (m) => mw(m.facilityMw) },
      { label: `IT load at ${pue} PUE`, value: (m) => mw(m.facilityMw / pue) },
      { label: "ZODE compute clusters", value: (m) => `${m.clusters} · ${mw(m.zodeMw)}` },
      { label: "Third-party GPU owners", value: (m) => (m.thirdPartyMw ? mw(m.thirdPartyMw) : "None") },
      { label: "First block ready", value: (m) => monthYear(m.firstReady) },
      { label: "Last block ready", value: (m) => monthYear(m.lastReady) },
    ],
  },
  {
    title: "Data center company",
    rows: [
      { label: "Acquisition and conversion", value: (m) => usdShort(m.acquisitionAndConversion) },
      { label: "Real estate debt, peak", value: (m) => usdShort(m.reDebtPeak) },
      { label: "Equity", value: (m) => usdShort(m.siteEquity) },
      { label: "Run-rate NOI", value: (m) => `${usdShort(m.runRateNoi)} / yr` },
      { label: "Yield on cost", value: (m) => irr(m.yieldOnCost) },
      { label: "Unlevered IRR", value: (m) => irr(m.unleveredIrr) },
      { label: "Equity IRR · multiple", value: (m) => returns(m.siteEquityIrr, m.siteEquityMultiple) },
      { label: "Value at exit", value: (m) => usdShort(m.exitValue) },
      { label: "Real estate DSCR, minimum", value: (m) => times(m.reDscrMin) },
    ],
  },
  {
    title: "Compute companies, every GPU generation",
    rows: [
      { label: "GPU hardware and setup", value: (m) => usdShort(m.gpuHardware) },
      { label: "Customer prepayments", value: (m) => usdShort(m.prepayments) },
      { label: "GPU debt", value: (m) => usdShort(m.gpuDebt) },
      { label: "Rent paid", value: (m) => usdShort(m.rentPaid) },
      { label: "Equity", value: (m) => usdShort(m.computeEquity) },
      { label: "Equity IRR · multiple", value: (m) => returns(m.computeEquityIrr, m.computeEquityMultiple) },
      { label: "GPU DSCR, minimum", value: (m) => times(m.gpuDscrMin) },
    ],
  },
];

/** The sites side by side with their total, each opening its folder and its own summary. */
function SitesTable({
  roomId,
  sites,
  total,
  pue,
  summaries,
}: {
  roomId: string;
  sites: PortfolioSite[];
  total: PortfolioMetrics;
  pue: number;
  summaries: Set<string>;
}): ReactElement {
  const columns = [...sites.map((s) => s.metrics), total];
  return (
    <div className={p.scroll}>
      <table className={p.table}>
        <thead>
          <tr>
            <td />
            {sites.map((s) => (
              <th key={s.name} scope="col" className={p.siteHead}>
                <span className={p.siteName}>
                  {s.folderId ? (
                    <FolderLink roomId={roomId} folderId={s.folderId}>
                      {s.name}
                    </FolderLink>
                  ) : (
                    s.name
                  )}
                </span>
                <span className={p.siteAddress}>{s.address}</span>
                {s.folderId && summaries.has(s.folderId) ? (
                  <span className={p.siteLink}>
                    <FolderLink roomId={roomId} folderId={s.folderId} summary>
                      Site summary
                    </FolderLink>
                  </span>
                ) : null}
              </th>
            ))}
            <th scope="col" className={p.siteHead}>
              <span className={p.siteName}>Total</span>
              <span className={p.siteAddress}>{plural(sites.length, "site", "sites")}</span>
            </th>
          </tr>
        </thead>
        {metricGroups(pue).map((group) => (
          <tbody key={group.title}>
            <tr className={p.groupRow}>
              <th scope="colgroup" colSpan={columns.length + 1}>
                {group.title}
              </th>
            </tr>
            {group.rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {columns.map((m, i) => (
                  <td key={i}>{row.value(m)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

/** What each site costs to buy and convert, then the terms they share. */
function siteTermGroups(m: PortfolioModel): { title: string; terms: Term[] }[] {
  const t = m.terms;
  return [
    ...m.sites.map((s) => {
      const st = s.terms;
      const conversion = st.conversionPerMw * s.metrics.facilityMw;
      return {
        title: s.name,
        terms: [
          { label: "Purchase price", value: usdShort(st.purchasePrice), note: `Closing ${monthYear(st.closeDate)}` },
          { label: "Deposit", value: usdShort(st.deposit), note: `Non-refundable, ${monthYear(st.depositDate)}` },
          {
            label: "Pre-development and closing",
            value: usdShort(st.preDevelopment + st.closingCosts),
            note: `${usdShort(st.preDevelopment)} pre-development, ${usdShort(st.closingCosts)} closing and transaction`,
          },
          {
            label: "Conversion",
            value: usdShort(conversion),
            note: `${usdShort(st.conversionPerMw, 2)} / MW of facility power`,
          },
          { label: "Utility re-energization", value: usdShort(st.utilityUpgrade) },
          {
            label: "IT load on the diligence basis",
            value: mw(st.diligenceItMw),
            note: `Against ${mw(s.metrics.facilityMw / t.pue)} from the sponsor's ${mw(s.metrics.facilityMw)} of facility power`,
          },
          ...(st.expansion
            ? [
                {
                  label: "Expansion option",
                  value: `+${mw(st.expansion.mw)} facility`,
                  note: `${st.expansion.included ? "In" : "Off in"} the base case, ${usdShort(st.expansion.cost)} upgrade`,
                },
              ]
            : []),
        ],
      };
    }),
    {
      title: "Every site",
      terms: [
        { label: "Rent", value: `$${t.rentPerKwMonth} / kW-mo`, note: "Per kW of facility power" },
        {
          label: "GPU contract",
          value: `$${t.contractPricePerGpuHour.toFixed(2)} / GPU-hr`,
          note: `${plural(t.contractMonths, "month", "months")}, ${pct(t.prepaymentShare, 1)} prepaid at GPU order`,
        },
        {
          label: "Cluster",
          value: `${t.gpusPerCluster.toLocaleString("en-US")} GPUs`,
          note: `${(t.gpusPerCluster / GPUS_PER_NODE).toLocaleString("en-US")} nodes per ${mw(m.total.zodeMw / m.total.clusters)} block`,
        },
        { label: "PUE", value: `${t.pue}`, note: "IT load is facility power over this" },
        {
          label: "Real estate debt",
          value: `${pct(t.reRate, 1)}`,
          note: `${pct(t.acquisitionLoan, 0)} of price at closing, ${pct(t.constructionLoan, 0)} of each contracted block's conversion`,
        },
        {
          label: "GPU debt",
          value: `${pct(t.gpuRate, 1)}`,
          note: `Sized to ${multiple(t.gpuDscr)} DSCR, up to ${pct(t.gpuMaxLtc, 0)} of cost`,
        },
        { label: "Exit", value: monthYear(t.exitDate), note: `Sites sold at a ${pct(t.exitCapRate, 2)} cap rate on run-rate NOI` },
        { label: "Schedule delay", value: plural(t.scheduleDelayMonths, "month", "months") },
      ],
    },
  ];
}

function investorTerms(r: InvestorReturns, title: string, extra: Term[] = []): { title: string; terms: Term[] } {
  return {
    title: `${title}, ${r.terms.name}`,
    terms: [
      { label: "Capital in", value: usdShort(r.capital) },
      { label: "Received", value: usdShort(r.received), note: `${usdShort(r.profitShare)} of it profit share after the hurdle` },
      { label: "IRR", value: irr(r.irr) },
      { label: "Multiple", value: times(r.multiple) },
      { label: "Paid first", value: prefLine(r.terms), note: tiersLine(r.terms) },
      ...extra,
    ],
  };
}

/** Rows of values under shared column headings. */
function Table({
  head,
  groups,
}: {
  head: string[];
  groups: { title?: string; rows: { label: string; values: string[] }[] }[];
}): ReactElement {
  return (
    <div className={p.scroll}>
      <table className={p.table}>
        <thead>
          <tr>
            <td />
            {head.map((h) => (
              <th key={h} scope="col" className={p.colHead}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((group, g) => (
          <tbody key={group.title ?? g}>
            {group.title ? (
              <tr className={p.groupRow}>
                <th scope="colgroup" colSpan={head.length + 1}>
                  {group.title}
                </th>
              </tr>
            ) : null}
            {group.rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {row.values.map((v, i) => (
                  <td key={i}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function Section({ id, title, action, children }: { id: string; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className={styles.section} aria-labelledby={`${id}-heading`}>
      <div className={styles.sectionHead}>
        <h2 id={`${id}-heading`} className={styles.heading}>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * A portfolio room's summary, the deal first: the model's results across its
 * sites, the capital that builds them and what each class of investor takes
 * out, the sites side by side, and the stored downside, base and upside runs
 * of the full program. Each site's diligence stays in its folder's own
 * summary, which opens from the sites table.
 */
export function PortfolioSummaryView({ roomId, summary }: { roomId: string; summary: PortfolioSummary }): ReactElement {
  const m = summary.model;
  const t = m.total;
  const gpus = t.clusters * m.terms.gpusPerCluster;
  const su = m.sourcesAndUses;
  const capital = Object.values(su.sources).reduce((total, v) => total + v, 0);
  const names = summary.sourceNames;
  const modelName = names.get(m.model.fileId);
  const caseLine = m.model.caseLine
    .split("|")
    .map((part) => part.trim())
    .slice(0, 2)
    .join(", ")
    .toLowerCase();
  const siteSummaries = new Set(summary.sites.flatMap(({ site, summary: s }) => (s && site.folderId ? [site.folderId] : [])));

  const lede =
    `${m.model.title} buys and converts ${mw(t.facilityMw)} of facility power, ${mw(t.facilityMw / m.terms.pue)} of IT load at ` +
    `${m.terms.pue} PUE, across ${andList(m.sites.map((s) => s.name))} ` +
    `for ${plural(t.clusters, "ZODE compute cluster", "ZODE compute clusters")} of ${gpus.toLocaleString("en-US")} GPUs: ` +
    `the first block ready ${monthYear(t.firstReady)}, the last ${monthYear(t.lastReady)}, and the sites sold ${monthYear(m.terms.exitDate)}.`;

  const keyFigures: KeyFigure[] = [
    { label: `Facility power, ${mw(t.facilityMw / m.terms.pue)} IT`, value: mw(t.facilityMw) },
    { label: `GPUs, ${plural(t.clusters, "cluster", "clusters")}`, value: gpus.toLocaleString("en-US") },
    { label: "Acquisition and conversion", value: usdShort(t.acquisitionAndConversion) },
    { label: `Capital to ${monthYear(su.through)}`, value: usdShort(capital) },
    { label: "Site equity", value: usdShort(su.sources.siteEquity) },
    { label: "Compute equity", value: usdShort(su.sources.computeEquity) },
    { label: "Site investors, IRR · multiple", value: returns(m.investors.site.irr, m.investors.site.multiple) },
    { label: "Compute investors, IRR · multiple", value: returns(m.investors.compute.irr, m.investors.compute.multiple) },
  ];

  return (
    <div className={styles.summary}>
      <Section
        id="deal"
        title="Deal summary"
        action={
          modelName ? (
            <Link
              href={`/portal/data-rooms/${roomId}?file=${m.model.fileId}`}
              data-file-id={m.model.fileId}
              className={styles.modelLink}
              title={m.model.path}
            >
              Model
              <Icon name="external" />
            </Link>
          ) : null
        }
      >
        <p className={styles.lede}>{lede}</p>
        <KeyFigures figures={keyFigures} />
        <CapitalStack sources={capitalStack(m)} payouts={payouts(m)} />
        <details className={styles.more}>
          <summary className={styles.moreHead}>
            Sources and uses to {monthYear(su.through)}
            <Icon name="chevron" className={styles.chevron} />
          </summary>
          <div className={styles.dealGroups}>
            <TermGroup
              title="Sources"
              terms={capitalStack(m)
                .filter((c) => c.amount > 0)
                .map((c) => ({ label: c.label, value: usdShort(c.amount), note: pct(c.amount / capital, 0) }))}
            />
            <TermGroup
              title="Uses"
              terms={su.uses
                .filter((u) => Math.abs(u.amount) > 0.5)
                .map((u) => ({ label: u.label, value: usdShort(u.amount), note: pct(u.amount / capital, 0) }))}
            />
          </div>
          <p className={styles.assumptions}>
            {m.model.description} From the first month to the last block ready, all sites and both layers.
          </p>
        </details>
      </Section>

      <Section id="sites" title="Sites">
        <SitesTable roomId={roomId} sites={m.sites} total={t} pue={m.terms.pue} summaries={siteSummaries} />
        <div className={styles.dealGroups}>
          {siteTermGroups(m).map((group) => (
            <TermGroup key={group.title} title={group.title} terms={group.terms} />
          ))}
        </div>
      </Section>

      <Section id="investors" title="Investor returns">
        <div className={styles.dealGroups}>
          <TermGroup
            {...investorTerms(m.investors.site, "Site investors", [
              { label: "ZODE co-investment", value: usdShort(m.investors.zodeCoInvest), note: "Across both layers" },
            ])}
          />
          <TermGroup {...investorTerms(m.investors.compute, "Compute investors")} />
        </div>
      </Section>

      <Section id="program" title={`Full program, ${mw(m.cases.facilityMw)} facility power`}>
        <p className={styles.lede}>
          The model&apos;s stored downside, base and upside runs, with {mw(m.cases.facilityMw - t.facilityMw)} of facility power at sites
          still to identify beside {andList(m.sites.map((s) => s.name))}. {sentence(m.cases.title.replace(/^[^-]*-\s*/, ""))}
        </p>
        <Table
          head={["Downside", "Base", "Upside"]}
          groups={[
            {
              title: "Assumptions",
              rows: m.cases.assumptions.map((a) => ({ label: a.label, values: a.values.map((v) => caseValue(a.format, v, 2)) })),
            },
            {
              title: "Results",
              rows: m.cases.results.map((r) => ({
                label: r.label.replace(" - ", ", "),
                values: r.values.map((v) => caseValue(r.format, v)),
              })),
            },
          ]}
        />
        <Table
          head={["Site IRR", "Site multiple", "Compute IRR", "Min. RE DSCR"]}
          groups={[
            {
              title: "Exit, base case",
              rows: m.exits.rows.map((r) => ({
                label: r.label,
                values: [irr(r.siteIrr), times(r.siteMultiple), irr(r.computeIrr), times(r.minReDscr)],
              })),
            },
          ]}
        />
        <Table
          head={["Site capital", "Peak RE debt", "Site IRR", "Site multiple", "Min. RE DSCR"]}
          groups={[
            {
              title: "Construction debt, base case",
              rows: m.debtSizing.rows.map((r) => ({
                label: r.label,
                values: [usdShort(r.siteCapital), usdShort(r.reDebtPeak), irr(r.siteIrr), times(r.siteMultiple), times(r.minReDscr)],
              })),
            },
          ]}
        />
        <div className={styles.assumptions}>
          {[...m.cases.notes, m.exits.note, m.debtSizing.note].map((note) => (
            <p key={note} className={p.note}>
              {note}
            </p>
          ))}
        </div>
      </Section>

      <p className={styles.assumptions}>
        {m.model.name}, {caseLine}. {m.model.prepared} Planning estimates, not an offer or investment advice.
      </p>
    </div>
  );
}
