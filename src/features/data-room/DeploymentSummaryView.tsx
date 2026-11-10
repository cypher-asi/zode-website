import type { ReactElement } from "react";
import { usdShort } from "@/features/compute-model/format";
import { modelValue, monthYear, mw, shortLabel, yearRows } from "./masterFormat";
import type { DeploymentSummary } from "./summary";
import { FolderLink, KeyFigures, ModelLink, plural, Section, Table, TermGroup, type KeyFigure, type Term } from "./SummaryParts";
import styles from "./Summary.module.css";
import t from "./Tables.module.css";

const TENURE = { own: "Owned sites", lease: "Leased colocation" };

/** How many of the workbook's key figures lead the summary, after its capacity. */
const LEADING_FIGURES = 7;

/**
 * A project folder's summary, from its SPV's tab of ZODE's master model: its
 * key figures, its results year by year, its capacity blocks and the inputs
 * behind them. The returns are the SPV's unlevered project IRR; the model
 * doesn't split cash between ZODE Inc. and preferred investors.
 */
export function DeploymentSummaryView({ roomId, summary }: { roomId: string; summary: DeploymentSummary }): ReactElement {
  const d = summary.model;
  const { spv, capacity } = d;
  const blocks = capacity.blocks;
  const sites = [...new Set(blocks.map((b) => b.site))];
  /** "online from July 2027, one block a month; ...": the workbook's aside on the capacity table. */
  const schedule = /\(([^)]*)\)/.exec(capacity.title)?.[1];
  const lede =
    `${d.description} ${spv.business}. ` +
    (blocks.length > 1
      ? `${mw(capacity.totalMw)} in ${plural(blocks.length, "block", "blocks")} from ${monthYear(blocks[0].inService)} to ${monthYear(blocks.at(-1)!.inService)}.`
      : `In service ${monthYear(spv.firstInService)}.`);

  // The indented figures split the equity between ZODE Inc. and third parties, which Capital shows.
  const figures = d.keyFigures.filter((k) => !k.indent);
  const keyFigures: KeyFigure[] = [
    { label: `Critical IT, ${TENURE[d.tenure].toLowerCase()}`, value: mw(capacity.totalMw) },
    ...figures.slice(0, LEADING_FIGURES).map((k) => ({ label: shortLabel(k.label), value: modelValue(k.value) })),
  ];
  const otherFigures: Term[] = figures.slice(LEADING_FIGURES).map((k) => ({ label: k.label, value: modelValue(k.value) }));
  const table = yearRows(d.summary);
  const parts = [...new Set(d.inputs.map((g) => g.part))];

  return (
    <div className={styles.summary}>
      <Section
        id="deployment"
        title={d.title}
        action={<ModelLink roomId={roomId} fileId={d.model.fileId} path={d.model.path} live={summary.sourceNames.has(d.model.fileId)} />}
      >
        <p className={styles.lede}>{lede}</p>
        <KeyFigures figures={keyFigures} />
        <div className={styles.dealGroups}>
          <TermGroup
            title="Capital"
            terms={[
              { label: "ZODE Inc. equity", value: usdShort(spv.zodeEquity), note: "From the pre-seed raise" },
              { label: "Third-party preferred", value: usdShort(spv.thirdPartyPref), note: "Funds the cash shortfalls after ZODE Inc.'s commitment" },
              { label: "Peak debt", value: usdShort(spv.peakDebt) },
              { label: "Capital stack", value: TENURE[d.tenure], note: spv.capitalStack },
            ]}
          />
          {otherFigures.length ? <TermGroup title="Other figures" terms={otherFigures} /> : null}
        </div>
      </Section>

      <Section id="years" title={`${spv.name} year by year, ${d.summary.years[0]} to ${d.summary.years.at(-1)}`}>
        <Table head={table.head} groups={table.groups} />
      </Section>

      <Section id="capacity" title="Capacity">
        <p className={styles.lede}>
          {schedule ? `${schedule.charAt(0).toUpperCase()}${schedule.slice(1)}.` : `${plural(blocks.length, "block", "blocks")}.`}
          {d.sites.length ? (
            <>
              {" "}
              Each site&apos;s own figures and diligence:{" "}
              {d.sites.map((s, i) => (
                <span key={s.folderId}>
                  {i ? ", " : ""}
                  <FolderLink roomId={roomId} folderId={s.folderId} summary>
                    {s.name}
                  </FolderLink>
                </span>
              ))}
              .
            </>
          ) : null}
        </p>
        <Table
          head={[...(sites.length > 1 ? ["Site"] : []), "Critical IT", "In service"]}
          groups={[
            {
              rows: [
                ...blocks.map((b) => ({
                  label: b.name,
                  values: [...(sites.length > 1 ? [b.site] : []), mw(b.mw), monthYear(b.inService)],
                })),
                ...(blocks.length > 1
                  ? [{ label: "Total", values: [...(sites.length > 1 ? [""] : []), mw(capacity.totalMw), ""], kind: "subtotal" as const }]
                  : []),
              ],
            },
          ]}
        />
      </Section>

      {parts.map((part) => (
        <Section key={part ?? ""} id={`inputs-${part ?? "spv"}`} title={part ? `Inputs: ${part.toLowerCase()}` : "Inputs"}>
          <div className={styles.dealGroups}>
            {d.inputs
              .filter((g) => g.part === part)
              .map((g) => (
                <TermGroup
                  key={g.title}
                  title={shortLabel(g.title)}
                  terms={g.terms.map((term) => ({ label: term.label, value: modelValue(term.value), note: term.note || undefined }))}
                />
              ))}
          </div>
        </Section>
      ))}

      <div className={styles.assumptions}>
        {d.openItems.map((item) => (
          <p key={item} className={t.note}>
            <strong>Open items and placeholders.</strong> {item}
          </p>
        ))}
        <p>
          {spv.entity}, from {d.model.name}. {d.model.prepared} Planning estimates, not an offer or investment advice.
        </p>
      </div>
    </div>
  );
}
