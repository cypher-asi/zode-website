import type { ReactElement } from "react";
import { multiple, orNa, pct, usdShort } from "./format";
import type { ModelResult } from "./model/engine";
import styles from "./Results.module.css";

interface Stat {
  label: string;
  value: string;
  tone?: "negative";
}

/**
 * The model's headline figures: four large returns and funding numbers, the
 * fuller set grouped as the workbook's Summary groups them.
 */
export function ResultsHeader({ result: r }: { result: ModelResult }): ReactElement {
  const negative = (n: number | null) => (n !== null && n < 0 ? "negative" : undefined);
  const hero: Stat[] = [
    { label: "Preferred IRR", value: orNa(r.prefIrr, (n) => pct(n, 1)), tone: negative(r.prefIrr) },
    { label: "Equity required", value: usdShort(r.prefEquity) },
    { label: "GPU loan", value: usdShort(r.loan) },
    { label: "Preferred MOIC", value: orNa(r.prefMoic, multiple), tone: r.prefMoic !== null && r.prefMoic < 1 ? "negative" : undefined },
  ];

  const groups: { title: string; stats: Stat[] }[] = [
    {
      title: "Returns",
      stats: [
        { label: "Pref distributions", value: usdShort(r.prefDistributions) },
        { label: "Pref profit", value: usdShort(r.prefProfit), tone: negative(r.prefProfit) },
        { label: "Common distributions", value: usdShort(r.commonDistributions) },
        { label: "Shareholder profit", value: usdShort(r.shareholderProfit), tone: negative(r.shareholderProfit) },
      ],
    },
    {
      title: "Funding",
      stats: [
        { label: "Equity by shipment", value: usdShort(r.prefEquityAtShipment) },
        { label: "Later equity calls", value: usdShort(r.prefEquityLater) },
        { label: "Prepayment", value: usdShort(r.prepayment) },
        { label: "DSCR funding gap", value: usdShort(r.dscrFundingGap) },
      ],
    },
    {
      title: "Debt",
      stats: [
        { label: "Requested loan", value: usdShort(r.requestedLoan) },
        { label: "Min quarterly DSCR", value: orNa(r.minQuarterlyDscr, multiple) },
        { label: "Year 1 DSCR", value: orNa(r.year1Dscr, multiple) },
        { label: "Reserve funded", value: usdShort(r.reserveFunded) },
      ],
    },
    {
      title: "Profit",
      stats: [
        { label: "Year 1 revenue", value: usdShort(r.year1Revenue) },
        { label: "Year 1 EBITDA", value: usdShort(r.year1Ebitda), tone: negative(r.year1Ebitda) },
        { label: "Contract net profit", value: usdShort(r.contractNetProfit), tone: negative(r.contractNetProfit) },
        { label: "Lifetime net profit", value: usdShort(r.lifetimeNetProfit), tone: negative(r.lifetimeNetProfit) },
      ],
    },
  ];

  return (
    <div className={styles.header}>
      <dl className={styles.hero}>
        {hero.map((s) => (
          <div key={s.label} className={styles.heroStat}>
            <dt className={styles.heroLabel}>{s.label}</dt>
            <dd className={styles.heroValue} data-tone={s.tone}>
              {s.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className={styles.groups}>
        {groups.map((g) => (
          <section key={g.title} className={styles.group} aria-label={g.title}>
            <h2 className={styles.groupTitle}>{g.title}</h2>
            <dl className={styles.stats}>
              {g.stats.map((s) => (
                <div key={s.label} className={styles.stat}>
                  <dt>{s.label}</dt>
                  <dd data-tone={s.tone}>{s.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * The checks the forecast fails, or a pass, as one line of pills that scrolls
 * sideways rather than wrapping, so its height never changes.
 */
export function ModelChecks({ result }: { result: ModelResult }): ReactElement {
  return (
    <ul className={styles.checks} aria-label="Model checks">
      {result.checks.length ? (
        result.checks.map((c) => (
          <li key={c.id} className={styles.check} data-tone="warning">
            {c.message}
          </li>
        ))
      ) : (
        <li className={styles.check} data-tone="ok">
          All checks pass
        </li>
      )}
    </ul>
  );
}

const STANDING_NOTES = [
  "Net profit includes depreciation, financing costs, project income tax and asset disposal gains or losses.",
  "The IRR uses dated monthly preferred cash flows.",
  "Figures are planning estimates, not an offer or investment advice.",
];

function loanNote(r: ModelResult): string {
  if (r.dscrFundingGap > 1) return `The DSCR covenant caps the loan; equity covers the ${usdShort(r.dscrFundingGap)} gap.`;
  if (r.loan > 1) return "The requested loan clears the DSCR covenant.";
  if (r.requestedLoan > 1) return "No GPU loan; equity funds the capex the prepayment leaves.";
  return "The customer prepayment covers the capex; no loan is needed.";
}

function callsNote(r: ModelResult): string {
  return r.prefEquityLater > 1
    ? `Operating shortfalls require ${usdShort(r.prefEquityLater)} of later preferred equity calls.`
    : "Operations fund themselves after shipment; no later equity calls.";
}

/**
 * How the current case is funded, then how the figures are built. The count
 * never changes, so moving a slider never resizes the chart above.
 */
export function ModelNotes({ result }: { result: ModelResult }): ReactElement {
  const notes = [loanNote(result), callsNote(result), ...STANDING_NOTES];
  return (
    <section className={styles.notes} aria-label="Notes">
      <h2 className={styles.groupTitle}>Notes</h2>
      <ul className={styles.noteList}>
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </section>
  );
}
