import type { ReactElement } from "react";
import Link from "next/link";
import { multiple, pct, usdShort } from "@/features/compute-model/format";
import type { ColoMetrics, ColoModel } from "./colo";
import { Icon } from "./icons";
import { Section, Table } from "./PortfolioSummaryView";
import type { ColoSummary } from "./summary";
import { KeyFigures, plural, TermGroup, type KeyFigure, type Term } from "./SummaryParts";
import styles from "./Summary.module.css";
import p from "./Portfolio.module.css";

/** "Apr 2027". */
const monthYear = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

const mw = (n: number) => `${Number(n.toFixed(2))} MW`;
/** The workbook reads n.m. where equity comes back about as soon as it goes in. */
const orNm = (n: number | null, f: (n: number) => string) => (n === null ? "n.m." : f(n));
const irr = (n: number | null) => orNm(n, (v) => pct(v, 1));
const times = (n: number | null) => orNm(n, (v) => multiple(v));
const gpuHour = (n: number) => `$${n.toFixed(2)} / GPU-hr`;
const andList = (names: string[]) =>
  names.length < 3 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
/** Yearly cash, with a dash where nothing moves. */
const cash = (n: number) => (Math.abs(n) < 500 ? "–" : usdShort(n));
const caseValue = (format: ColoModel["cases"]["head"][number]["format"], n: number | null) =>
  n === null ? "n.m." : format === "mw" ? mw(n) : format === "usd" ? usdShort(n) : format === "pct" ? pct(n, 1) : multiple(n);

function capitalTerms(m: ColoMetrics, lease: ColoModel["deployment"]["lease"]): Term[] {
  return [
    {
      label: "Lease NRC, upfront payments and legal",
      value: usdShort(m.leaseUpfront),
      note: `${usdShort(lease.nrc)} to the data center, ${usdShort(lease.legal)} legal and structuring`,
    },
    { label: "GPU hardware, spares, tax and setup", value: usdShort(m.gpuHardware) },
    { label: "Customer prepayments", value: usdShort(m.prepayments), note: `${pct(m.prepayments / m.contractValue, 1)} of contract value` },
    { label: "GPU debt", value: usdShort(m.gpuDebt), note: `Lowest DSCR ${times(m.gpuDscrMin)}` },
    ...(m.receivablePeak > 0 ? [{ label: "Receivable loan, peak", value: usdShort(m.receivablePeak) }] : []),
    { label: "Peak equity", value: usdShort(m.peakEquity, 2), note: monthYear(m.peakEquityDate) },
    ...m.equityBy.map((e) => ({ label: `Equity needed by ${e.label}`, value: usdShort(e.amount, 2) })),
  ];
}

/**
 * A project folder's summary, from one deployment of a ZODE Colo workbook:
 * its clusters, results and terms, its cash year by year, the stored raise
 * cases that take it in, and the program it's pooled in. GPU compute
 * companies in leased colocation space, so no real estate.
 */
export function ColoSummaryView({ roomId, summary }: { roomId: string; summary: ColoSummary }): ReactElement {
  const m = summary.model;
  const d = m.deployment;
  const k = d.metrics;
  const modelName = summary.sourceNames.get(m.model.fileId);
  const unsigned = k.clusters - k.signedClusters;
  const caseLine = m.model.caseLine
    .split("|")
    .map((part) => part.trim())
    .slice(0, 2)
    .join(", ")
    .toLowerCase();
  const { investors } = m.program;

  const signed = d.clusters.filter((c) => c.signed).map((c) => c.name);
  const target = d.clusters.filter((c) => !c.signed).map((c) => c.name.toLowerCase());
  const signedTerms = `at ${gpuHour(d.contract.price)} for ${plural(d.contract.months, "month", "months")}, ${pct(d.contract.prepayment, 0)} prepaid`;
  const targetTerms = `priced at a ${gpuHour(d.target.price)} target`;
  const contracts = !signed.length
    ? `None is under contract yet; each is ${targetTerms}`
    : `${andList(signed)} ${signed.length === 1 ? "is" : "are"} under a signed contract ${signedTerms}` +
      (target.length ? `, and ${andList(target)} ${target.length === 1 ? "is" : "are"} ${targetTerms}` : "");
  const lede =
    `${m.model.title}'s ${d.name} deployment: ${plural(k.clusters, "GPU cluster", "GPU clusters")}, ` +
    `${k.gpus.toLocaleString("en-US")} GPUs and ${mw(k.criticalItMw)} of critical IT in leased colocation space, ` +
    `each cluster its own compute company. ${contracts}. ` +
    (k.clusters > 1
      ? `The first is in service ${monthYear(k.firstInService)}, the last ${monthYear(k.lastInService)}.`
      : `In service ${monthYear(k.firstInService)}.`);

  const keyFigures: KeyFigure[] = [
    { label: `Critical IT, ${plural(k.clusters, "cluster", "clusters")}`, value: mw(k.criticalItMw) },
    { label: "GPUs", value: k.gpus.toLocaleString("en-US") },
    { label: "Contract value", value: usdShort(k.contractValue) },
    { label: "Revenue, contract and merchant", value: usdShort(k.lifetimeRevenue) },
    { label: "GPU hardware and setup", value: usdShort(k.gpuHardware) },
    { label: "GPU debt", value: usdShort(k.gpuDebt) },
    { label: "Peak equity", value: usdShort(k.peakEquity, 2) },
    { label: "Unlevered IRR · equity multiple", value: `${irr(k.unleveredIrr)} · ${times(k.equityMultiple)}` },
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
        <div className={styles.dealGroups}>
          <TermGroup title="Capital" terms={capitalTerms(k, d.lease)} />
          <TermGroup
            title="Returns, before the investor split"
            terms={[
              { label: "Unlevered IRR", value: irr(k.unleveredIrr) },
              { label: "Equity IRR", value: irr(k.equityIrr), note: k.equityIrr === null ? "Not meaningful in the model" : undefined },
              { label: "Equity multiple", value: times(k.equityMultiple) },
              { label: "Net cash after equity", value: usdShort(k.netCash) },
            ]}
          />
        </div>
      </Section>

      <Section id="clusters" title="Clusters and terms">
        <Table
          head={["Nodes", "GPUs", "Critical IT", "Contract", "In service"]}
          groups={[
            {
              rows: d.clusters.map((c) => ({
                label: c.name,
                values: [
                  String(c.nodes),
                  c.gpus.toLocaleString("en-US"),
                  mw(c.criticalItMw),
                  c.signed ? `Signed, ${gpuHour(d.contract.price)}` : `Target, ${gpuHour(d.target.price)}`,
                  monthYear(c.inService),
                ],
              })),
            },
          ]}
        />
        <div className={styles.dealGroups}>
          <TermGroup
            title="Colocation lease"
            terms={[
              { label: "Base rent", value: `$${d.lease.baseRent} / kW-mo`, note: "Per kW of critical IT" },
              { label: "NNN pass-through", value: `$${d.lease.nnn} / kW-mo` },
              { label: "Facility operations", value: `$${d.lease.operations} / kW-mo` },
              { label: "Electricity", value: `$${d.lease.electricity.toFixed(3)} / kWh`, note: `At ${d.lease.pue} PUE` },
              { label: "Escalation", value: `${pct(d.lease.escalation, 1)} / yr`, note: "Lease, power and operating costs; contract prices are flat" },
              { label: "NRC and upfront payment", value: usdShort(d.lease.nrc), note: "At lease signing" },
              ...(d.lease.salesTax > 0 ? [{ label: "Sales and use tax on hardware", value: pct(d.lease.salesTax, 2) }] : []),
            ]}
          />
          <TermGroup
            title="Customer contracts"
            terms={[
              {
                label: "Signed",
                value: gpuHour(d.contract.price),
                note: `${plural(d.contract.months, "month", "months")}, ${pct(d.contract.prepayment, 1)} prepaid`,
              },
              ...(unsigned
                ? [
                    {
                      label: "Target, not yet sold",
                      value: gpuHour(d.target.price),
                      note: `${plural(d.target.months, "month", "months")}, ${pct(d.target.prepayment, 1)} prepaid at GPU order`,
                    },
                  ]
                : []),
              {
                label: "After each contract",
                value: gpuHour(d.after.price),
                note: `${plural(d.after.months, "month", "months")} at ${pct(d.after.utilization, 0)} utilization, then resold for ${pct(d.after.resale, 0)} of hardware cost`,
              },
            ]}
          />
          <TermGroup
            title="GPUs and debt"
            terms={[
              {
                label: "Server",
                value: `${usdShort(d.gpu.serverCost)} / node`,
                note: `${d.gpu.gpusPerNode} GPUs; ${pct(d.gpu.networking, 0)} more for networking and storage`,
              },
              { label: "Order deposit", value: pct(d.gpu.deposit, 0), note: "Of hardware at order, the balance at shipment" },
              {
                label: "GPU debt",
                value: pct(d.gpu.rate, 1),
                note: `${plural(d.gpu.tenorMonths, "month", "months")}, sized to ${multiple(d.gpu.dscr)} DSCR, up to ${pct(d.gpu.maxLtc, 0)} of cost`,
              },
              { label: "Debt service reserve", value: pct(d.gpu.reserve, 0), note: "Of the loan" },
            ]}
          />
        </div>
      </Section>

      <Section id="cash" title={`Cash flow, ${d.annual.years[0]} to ${d.annual.years.at(-1)}`}>
        <Table
          head={[...d.annual.years.map(String), "Total"]}
          groups={[
            {
              rows: d.annual.rows.map((r) => ({
                label: r.label,
                values: [...r.values.map(cash), r.total === null ? "" : cash(r.total)],
              })),
            },
          ]}
        />
        <p className={styles.assumptions}>{d.annual.note}. Standalone, before pooling in {m.model.title}.</p>
      </Section>

      <Section id="cases" title="Raise cases">
        <Table
          head={m.cases.head.map((h) => h.label)}
          groups={[
            {
              rows: m.cases.rows.map((r) => ({
                label: r.label,
                values: r.values.map((v, i) => caseValue(m.cases.head[i].format, v)),
              })),
            },
          ]}
        />
      </Section>

      <Section id="program" title={`In ${m.model.title}`}>
        <p className={styles.lede}>
          {m.program.description} Investors put {usdShort(investors.capital)} into the pool and receive {usdShort(investors.received)},{" "}
          {times(investors.multiple)} (IRR {irr(investors.irr)}) under term set {investors.termSet}, first paid {monthYear(investors.firstCash)}.
        </p>
        <Table
          head={[...m.program.deployments.map((x) => x.name), "Total"]}
          groups={[
            {
              rows: [
                { label: "Critical IT", values: [...m.program.deployments.map((x) => mw(x.criticalItMw)), mw(m.program.total.criticalItMw)] },
                {
                  label: "GPU clusters",
                  values: [...m.program.deployments.map((x) => String(x.clusters)), String(m.program.total.clusters)],
                },
                {
                  label: "Peak equity (Total pooled)",
                  values: [...m.program.deployments.map((x) => usdShort(x.peakEquity, 2)), usdShort(m.program.total.peakEquity, 2)],
                },
                {
                  label: "Unlevered IRR",
                  values: [...m.program.deployments.map((x) => irr(x.unleveredIrr)), irr(m.program.total.unleveredIrr)],
                },
              ],
            },
          ]}
        />
      </Section>

      <div className={styles.assumptions}>
        {m.notes.map((note) => (
          <p key={note} className={p.note}>
            {note}
          </p>
        ))}
        <p>
          {m.model.name}, {caseLine}. {m.model.prepared} Planning estimates, not an offer or investment advice.
        </p>
      </div>
    </div>
  );
}
