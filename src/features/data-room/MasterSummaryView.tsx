import type { ReactElement } from "react";
import { pct, usdShort } from "@/features/compute-model/format";
import { Icon } from "./icons";
import type { MasterSpv } from "./master";
import { findRow, monthYear, yearRows } from "./masterFormat";
import type { MasterSummary } from "./summary";
import { FolderLink, KeyFigures, ModelLink, plural, Section, Table, TermGroup, type KeyFigure, type TableRow } from "./SummaryParts";
import styles from "./Summary.module.css";
import t from "./Tables.module.css";

const andList = (names: string[]) =>
  names.length < 3 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
const sum = (spvs: MasterSpv[], amount: (s: MasterSpv) => number) => spvs.reduce((total, s) => total + amount(s), 0);

/** The SPVs side by side with their total, each opening its folder and the deployment summary there. */
function SpvTable({ roomId, spvs, summaries }: { roomId: string; spvs: MasterSpv[]; summaries: Set<string> }): ReactElement {
  const rows: (TableRow & { total?: string })[] = [
    { label: "ZODE Inc. equity", values: spvs.map((s) => usdShort(s.zodeEquity)), total: usdShort(sum(spvs, (s) => s.zodeEquity)) },
    { label: "Third-party preferred", values: spvs.map((s) => usdShort(s.thirdPartyPref)), total: usdShort(sum(spvs, (s) => s.thirdPartyPref)) },
    { label: "Peak debt", values: spvs.map((s) => usdShort(s.peakDebt)), total: usdShort(sum(spvs, (s) => s.peakDebt)) },
    { label: "First month in service", values: spvs.map((s) => monthYear(s.firstInService)) },
  ];
  return (
    <div className={t.scroll}>
      <table className={`${t.table} ${t.even}`}>
        <colgroup>
          <col className={t.labelColumn} />
          {spvs.map((s) => (
            <col key={s.name} />
          ))}
          <col />
        </colgroup>
        <thead>
          <tr>
            <td />
            {spvs.map((s) => (
              <th key={s.name} scope="col" className={t.siteHead}>
                <span className={t.siteName}>
                  {s.folderId ? (
                    <FolderLink roomId={roomId} folderId={s.folderId}>
                      {s.name}
                    </FolderLink>
                  ) : (
                    s.name
                  )}
                </span>
                <span className={t.siteAddress}>{s.business.split(":")[0]}</span>
                {s.folderId && summaries.has(s.folderId) ? (
                  <span className={t.siteLink}>
                    <FolderLink roomId={roomId} folderId={s.folderId} summary>
                      Deployment summary
                    </FolderLink>
                  </span>
                ) : null}
              </th>
            ))}
            <th scope="col" className={t.siteHead}>
              <span className={t.siteName}>Total</span>
              <span className={t.siteAddress}>{plural(spvs.length, "SPV", "SPVs")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              {row.values.map((v, i) => (
                <td key={i}>{v}</td>
              ))}
              <td>{row.total ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A company room's summary, from ZODE's master model: the pre-seed raise and
 * where it goes, the project SPVs side by side, and the consolidated
 * statement year by year. Each SPV's own tab is its folder's deployment
 * summary, which opens from the SPV table.
 */
export function MasterSummaryView({ roomId, summary }: { roomId: string; summary: MasterSummary }): ReactElement {
  const m = summary.model;
  const { raise, statement } = m;
  const funded = m.spvs.filter((s) => s.zodeEquity > 0);
  const zodeEquity = sum(m.spvs, (s) => s.zodeEquity);
  const first = statement.years[0];
  const last = statement.years.at(-1);
  const span = `${first} to ${last}`;
  const revenue = findRow(statement, "Total revenue");
  const ebitda = findRow(statement, "EBITDA");
  const capacity = statement.groups[0]?.rows[0];
  const attributable = findRow(statement, "Cash attributable to ZODE Inc.");

  const lede =
    `ZODE Inc. raises ${usdShort(raise.amount, 0)} of pre-seed equity, a ${raise.terms.replace(/^\$[\d.]+[MK]?\s*/, "")}, ` +
    `for ${pct(raise.ownership, 1)} of the company, received ${monthYear(raise.received)}. ` +
    `It puts ${usdShort(zodeEquity)} of equity into ${andList(funded.map((s) => `${s.name} (${usdShort(s.zodeEquity)})`))}, ` +
    `beside ${usdShort(sum(m.spvs, (s) => s.thirdPartyPref))} of third-party preferred equity in the SPVs.`;

  const keyFigures: KeyFigure[] = [
    { label: "Pre-seed raise", value: usdShort(raise.amount, 0) },
    { label: "Post-money valuation cap", value: usdShort(raise.postMoneyCap, 0) },
    { label: "Pre-seed ownership", value: pct(raise.ownership, 1) },
    { label: "ZODE Inc. equity into SPVs", value: usdShort(zodeEquity) },
    ...(capacity ? [{ label: `GPU clusters in service, Dec ${last}`, value: `${Number(capacity.values.at(-1)?.toFixed(0))} MW` }] : []),
    ...(revenue?.total != null ? [{ label: `Revenue, ${span}`, value: usdShort(revenue.total) }] : []),
    ...(ebitda?.total != null ? [{ label: `EBITDA, ${span}`, value: usdShort(ebitda.total) }] : []),
    ...(attributable ? [{ label: `Cash attributable to ZODE Inc., Dec ${last}`, value: usdShort(attributable.values.at(-1) ?? 0) }] : []),
  ];
  const table = yearRows(statement);

  return (
    <div className={styles.summary}>
      <Section
        id="raise"
        title="ZODE Inc. pre-seed"
        action={<ModelLink roomId={roomId} fileId={m.model.fileId} path={m.model.path} live={summary.sourceNames.has(m.model.fileId)} />}
      >
        <p className={styles.lede}>{lede}</p>
        <KeyFigures figures={keyFigures} />
        <div className={styles.dealGroups}>
          <TermGroup
            title="Raise"
            terms={[
              { label: "Pre-seed equity", value: usdShort(raise.amount, 0), note: raise.terms },
              { label: "Post-money valuation cap", value: usdShort(raise.postMoneyCap, 0) },
              { label: "Pre-seed ownership at the cap", value: pct(raise.ownership, 1) },
              { label: "Received", value: monthYear(raise.received) },
            ]}
          />
          <TermGroup
            title="Use of proceeds"
            terms={m.uses.map((u) => ({ label: u.label, value: usdShort(u.amount), note: pct(u.amount / raise.amount, 0) }))}
          />
        </div>
        <details className={styles.more}>
          <summary className={styles.moreHead}>
            How the model works
            <Icon name="chevron" className={styles.chevron} />
          </summary>
          <div className={styles.detail}>
            <p>ZODE Inc. (TopCo): {m.topco}</p>
            {m.overview.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </details>
      </Section>

      <Section id="spvs" title="Project SPVs">
        <SpvTable roomId={roomId} spvs={m.spvs} summaries={summary.deploymentSummaries} />
        <div className={styles.assumptions}>
          {m.spvs.map((s) => (
            <p key={s.name} className={t.note}>
              <strong>{s.entity}.</strong> {s.business}. {s.capitalStack}
            </p>
          ))}
          {m.structureNotes.map((note) => (
            <p key={note} className={t.note}>
              {note}
            </p>
          ))}
        </div>
      </Section>

      <Section id="consolidated" title={`Consolidated, ${span}`}>
        <Table head={table.head} groups={table.groups} />
      </Section>

      <div className={styles.assumptions}>
        {[...m.conventions, ...m.simplifications].map((note) => (
          <p key={note} className={t.note}>
            {note}
          </p>
        ))}
        {m.openItems.length ? (
          <p className={t.note}>
            <strong>Open items and placeholders.</strong> {m.openItems.join(" ")}
          </p>
        ) : null}
        <p>
          {m.model.name}. {m.model.prepared} Planning estimates, not an offer or investment advice.
        </p>
      </div>
    </div>
  );
}
