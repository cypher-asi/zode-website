import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import { multiple, pct, usdShort } from "@/features/compute-model/format";
import { Icon } from "./icons";
import { FolderLink, Section, Table } from "./PortfolioSummaryView";
import type { TopCoModel, TopCoProject, TopCoTotal } from "./topco";
import type { TopCoSummary } from "./summary";
import { KeyFigures, plural, Prose, TermGroup, type KeyFigure } from "./SummaryParts";
import styles from "./Summary.module.css";
import p from "./Portfolio.module.css";

const mw = (n: number) => `${Number(n.toFixed(2))} MW`;
const orNa = (n: number | null, f: (n: number) => string) => (n === null ? "n.a." : f(n));
const irr = (n: number | null) => orNa(n, (v) => pct(v, 1));
const returns = (rate: number | null, x: number | null) => `${irr(rate)} · ${orNa(x, (v) => multiple(v))}`;
/** Yearly cash, with a dash where nothing moves. */
const cash = (n: number) => (Math.abs(n) < 500 ? "–" : usdShort(n));
const andList = (names: string[]) =>
  names.length < 3 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

const TENURE: Record<TopCoProject["tenure"], string> = { own: "Own", lease: "Lease" };

/** A rate for each of a project's SPVs, each beside its layer's name where there are several. */
function byLayer<T extends { layer: string }>(values: T[], format: (v: T) => string): ReactNode {
  if (values.length === 1) return format(values[0]);
  return values.map((v) => (
    <span key={v.layer} className={p.layer}>
      {format(v)}
      <span className={p.layerName}>{v.layer}</span>
    </span>
  ));
}

interface ProjectRow {
  label: string;
  value: (m: TopCoProject) => ReactNode;
  /** The Total column's value; blank where the workbook adds nothing up. */
  total?: (t: TopCoTotal) => string;
}

const projectGroups: { title: string; rows: ProjectRow[] }[] = [
  {
    title: "Capital",
    rows: [
      { label: "Critical IT at full build", value: (m) => mw(m.criticalItMw), total: (t) => mw(t.criticalItMw) },
      { label: "Project cost, GPU refreshes included", value: (m) => usdShort(m.projectCost), total: (t) => usdShort(t.projectCost) },
      { label: "Debt drawn", value: (m) => usdShort(m.debt), total: (t) => usdShort(t.debt) },
      { label: "Preferred equity", value: (m) => usdShort(m.prefNeeded), total: (t) => usdShort(t.prefNeeded) },
      { label: "From ZODE TopCo", value: (m) => usdShort(m.topcoPref), total: (t) => usdShort(t.topcoPref) },
      { label: "From third parties", value: (m) => usdShort(m.thirdPartyPref), total: (t) => usdShort(t.thirdPartyPref) },
    ],
  },
  {
    title: "Returns",
    rows: [
      { label: "Project IRR, unlevered", value: (m) => byLayer(m.projectIrr, (v) => irr(v.value)) },
      { label: "Preferred investors, IRR · multiple", value: (m) => byLayer(m.pref, (v) => returns(v.irr, v.multiple)) },
      { label: "Cash to ZODE TopCo: pref, common and fees", value: (m) => usdShort(m.cashToTopco), total: (t) => usdShort(t.cashToTopco) },
      { label: "ZODE TopCo, IRR · multiple", value: (m) => returns(m.topcoIrr, m.topcoMultiple) },
    ],
  },
];

/** The projects side by side with their total, each opening its folder and the summary there. */
function ProjectsTable({ roomId, m, summaries }: { roomId: string; m: TopCoModel; summaries: Set<string> }): ReactElement {
  return (
    <div className={p.scroll}>
      <table className={`${p.table} ${p.even}`}>
        <colgroup>
          <col className={p.labelColumn} />
          {m.projects.map((s) => (
            <col key={s.name} />
          ))}
          <col />
        </colgroup>
        <thead>
          <tr>
            <td />
            {m.projects.map((s) => (
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
                <span className={p.siteAddress}>{TENURE[s.tenure]}</span>
                {s.folderId && summaries.has(s.folderId) ? (
                  <span className={p.siteLink}>
                    <FolderLink roomId={roomId} folderId={s.folderId} summary>
                      Project summary
                    </FolderLink>
                  </span>
                ) : null}
              </th>
            ))}
            <th scope="col" className={p.siteHead}>
              <span className={p.siteName}>Total</span>
              <span className={p.siteAddress}>{plural(m.projects.length, "project", "projects")}</span>
            </th>
          </tr>
        </thead>
        {projectGroups.map((group) => (
          <tbody key={group.title}>
            <tr className={p.groupRow}>
              <th scope="colgroup" colSpan={m.projects.length + 2}>
                {group.title}
              </th>
            </tr>
            {group.rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {m.projects.map((s) => (
                  <td key={s.name}>{row.value(s)}</td>
                ))}
                <td>{row.total ? row.total(m.total) : ""}</td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

/**
 * A company room's summary, from the TopCo workbook: the pre-seed raise and
 * where it goes, the project SPVs it funds side by side, TopCo's cash year by
 * year and what the pre-seed investors take out. Each project's own model
 * stays in its folder's summary, which opens from the projects table.
 */
export function TopCoSummaryView({ roomId, summary }: { roomId: string; summary: TopCoSummary }): ReactElement {
  const m = summary.model;
  const { raise, total } = m;
  const modelName = summary.sourceNames.get(m.model.fileId);
  const funded = m.projects.filter((s) => s.topcoPref > 0);
  const budget = m.uses.find((u) => !/pref/i.test(u.label));
  const lastYear = m.cash.years.at(-1);

  const lede =
    `ZODE raises ${usdShort(raise.amount)} of pre-seed equity at TopCo, ${usdShort(raise.preMoney, 0)} pre-money, ` +
    `for ${pct(raise.ownership, 1)} of the company. ` +
    `${budget ? `${usdShort(budget.amount)} runs TopCo and ` : ""}${usdShort(total.topcoPref)} goes into ` +
    `${andList(funded.map((s) => `${s.name} (${usdShort(s.topcoPref, 0)})`))} as preferred equity, ` +
    `beside ${usdShort(total.thirdPartyPref)} of third-party preferred and ${usdShort(total.debt)} of debt ` +
    `for ${mw(total.criticalItMw)} of critical IT.`;

  const keyFigures: KeyFigure[] = [
    { label: "Pre-seed raise", value: usdShort(raise.amount, 0) },
    { label: `Pre-money, ${usdShort(raise.postMoney, 0)} post`, value: usdShort(raise.preMoney, 0) },
    { label: "Pre-seed ownership", value: pct(raise.ownership, 1) },
    { label: `Pre-seed IRR · multiple, to ${m.returns.through}`, value: returns(m.returns.preSeedIrr, m.returns.preSeedMultiple) },
    { label: `Critical IT, ${plural(m.projects.length, "project", "projects")}`, value: mw(total.criticalItMw) },
    { label: `Project cost to ${m.returns.through}`, value: usdShort(total.projectCost) },
    { label: `Cash to TopCo to ${m.returns.through}`, value: usdShort(total.cashToTopco) },
    { label: "Lowest TopCo cash", value: usdShort(m.returns.lowestCash) },
  ];

  return (
    <div className={styles.summary}>
      <Section
        id="raise"
        title={`${m.model.title} pre-seed`}
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
          <TermGroup
            title="Raise"
            terms={[
              { label: "Pre-seed equity", value: usdShort(raise.amount, 0), note: `Closing ${raise.closeYear}` },
              { label: "Pre-money valuation", value: usdShort(raise.preMoney, 0) },
              { label: "Post-money valuation", value: usdShort(raise.postMoney, 0) },
              { label: "Pre-seed ownership", value: pct(raise.ownership, 1), note: "Fully diluted, no option pool" },
              { label: "Cash kept before distributions", value: usdShort(raise.minCash, 0) },
            ]}
          />
          <TermGroup
            title="Use of proceeds"
            terms={m.uses
              .filter((u) => u.amount > 0)
              .map((u) => ({ label: u.label, value: usdShort(u.amount, 0), note: u.note || pct(u.amount / raise.amount, 0) }))}
          />
        </div>
        <details className={styles.more}>
          <summary className={styles.moreHead}>
            How the model works
            <Icon name="chevron" className={styles.chevron} />
          </summary>
          <Prose text={m.overview} />
        </details>
      </Section>

      <Section id="projects" title="Projects">
        <ProjectsTable roomId={roomId} m={m} summaries={summary.projectSummaries} />
      </Section>

      <Section id="topco-cash" title={`TopCo cash, ${m.cash.years[0]} to ${lastYear}`}>
        <Table
          head={[...m.cash.years.map(String), "Total"]}
          groups={[
            {
              rows: m.cash.rows.map((r) => ({
                label: r.label,
                values: [...r.values.map(cash), r.total === null ? "" : cash(r.total)],
              })),
            },
          ]}
        />
      </Section>

      <Section id="returns" title="Pre-seed returns and TopCo costs">
        <div className={styles.dealGroups}>
          <TermGroup
            title="Pre-seed investors"
            terms={[
              { label: "IRR", value: irr(m.returns.preSeedIrr), note: `Distributions through ${m.returns.through}; no terminal value for TopCo` },
              { label: "Multiple", value: orNa(m.returns.preSeedMultiple, (v) => multiple(v)) },
              { label: "Lowest TopCo cash", value: usdShort(m.returns.lowestCash) },
              {
                label: "TopCo costs the operating budget covers",
                value: `${m.returns.budgetYears.toFixed(1)} years`,
                note: budget ? `${usdShort(budget.amount, 0)} over the average of the first three years' costs` : undefined,
              },
            ]}
          />
          <TermGroup
            title="Team"
            terms={m.team
              .filter((h) => h.headcount > 0)
              .map((h) => ({
                label: h.role,
                value: `${h.headcount} × ${usdShort(h.salary, 0)}`,
                note: `From ${h.startYear}`,
              }))}
          />
        </div>
      </Section>

      <div className={styles.assumptions}>
        {m.notes.map((note) => (
          <p key={note} className={p.note}>
            {note}
          </p>
        ))}
        <p>
          {m.model.name}. {m.model.prepared} Planning estimates, not an offer or investment advice.
        </p>
      </div>
    </div>
  );
}
