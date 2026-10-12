import type { ReactElement } from "react";
import { millions } from "./format";
import type { ModelResult } from "./model/engine";
import styles from "./Results.module.css";

const COLUMNS = [
  { key: "netRevenue", label: "Net revenue" },
  { key: "ebitda", label: "SPV EBITDA" },
  { key: "netProfit", label: "Net profit" },
  { key: "prefContributions", label: "Preferred calls" },
  { key: "prefDistributions", label: "Preferred paid" },
  { key: "commonDistributions", label: "Common paid" },
  { key: "debtService", label: "Debt service" },
] as const;

/** The workbook's annual results and cash distributions table, in USD millions. */
export function AnnualTable({ result }: { result: ModelResult }): ReactElement {
  const m = result.monthly;
  const total = (key: (typeof COLUMNS)[number]["key"], from: number, to: number) => {
    let t = 0;
    for (let k = from; k < to; k++) t += m[key][k];
    return t;
  };
  const rows = result.periods.filter((p) => p.to > p.from);
  const last = m.dates.length;

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className={styles.caption}>Annual results and cash distributions (USD millions)</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            {COLUMNS.map((c) => (
              <th key={c.key} scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.label}>
              <th scope="row">{p.label === "Remaining" ? "Remaining forecast" : p.label}</th>
              {COLUMNS.map((c) => {
                const v = total(c.key, p.from, p.to);
                return (
                  <td key={c.key} data-tone={v < -5_000 ? "negative" : undefined}>
                    {millions(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total forecast</th>
            {COLUMNS.map((c) => {
              const v = total(c.key, 0, last);
              return (
                <td key={c.key} data-tone={v < -5_000 ? "negative" : undefined}>
                  {millions(v)}
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
