import { multiple, pct, usd, usdShort } from "@/features/compute-model/format";
import type { ModelValue, YearRow, YearTable } from "./master";
import type { TableRow } from "./SummaryParts";

/** "Apr 2027". */
export const monthYear = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

export const mw = (n: number) => `${Number(n.toFixed(2))} MW`;

export const irr = (n: number | null) => (n === null ? "n.a." : pct(n, 1));

/** A label without the workbook's trailing aside, such as "(annualized, to Dec 2036 incl. book value)". */
export const shortLabel = (label: string) => label.replace(/\s*\([^)]*\)\s*$/, "");

/** A value as the workbook formats it, large amounts in short form; small ones keep a second decimal, as in "$1.25M" or "7.25%". */
export function modelValue(v: ModelValue): string {
  if (typeof v.value === "string") return v.format === "month" ? monthYear(v.value) : v.value;
  const n = v.value;
  const money = (text: string) => (v.currency ? text.replace("$", v.currency) : text);
  switch (v.format) {
    case "usd":
      return money(Math.abs(n) >= 1e6 ? usdShort(n, Math.abs(n) < 1e7 ? 2 : 1) : usd(n));
    case "usdCents":
      return money(`$${n.toFixed(2)}`);
    case "pct":
      return pct(n, Math.abs(n) < 0.1 ? 2 : 1);
    case "x":
      return multiple(n);
    case "decimal":
      return n.toFixed(2);
    default:
      return Number(n.toFixed(1)).toLocaleString("en-US");
  }
}

/** A yearly cell, with a dash where nothing moves. */
export function yearValue(n: number, unit: YearRow["unit"]): string {
  if (unit === "mw") return n === 0 ? "–" : `${Number(n.toFixed(1))} MW`;
  if (unit === "count") return n === 0 ? "–" : n.toLocaleString("en-US");
  return Math.abs(n) < 500 ? "–" : usdShort(n);
}

/** "Revenue" for "Revenue: Toronto"; null for a row that isn't one of a kind, such as a subtotal or a part of the row above. */
const prefixOf = (row: YearRow): string | null =>
  row.kind || row.indent ? null : (/^([^:]+):\s+\S/.exec(row.label)?.[1] ?? null);

/**
 * A yearly table's head and rows, each row's total last; blank where the
 * workbook adds nothing up. Neighboring rows that share a prefix, such as
 * "Revenue: Toronto" and "Revenue: Calgary", sit under it as a heading, named
 * by what follows it. A row the workbook gives above its indented parts heads
 * them instead, its figures totalling them below, as a statement reads; a
 * collapsed one keeps its figures and opens to its parts.
 */
export function yearRows(table: YearTable): { head: string[]; groups: { title: string; rows: TableRow[] }[] } {
  const cells = (r: YearRow) => [...r.values.map((v) => yearValue(v, r.unit)), r.total === null ? "" : yearValue(r.total, r.unit)];
  return {
    head: [...table.years, "Total"],
    groups: table.groups.map((g) => ({
      title: g.title,
      rows: g.rows.flatMap((r, i, rows): TableRow[] => {
        const next = rows[i + 1];
        const parent = r.indent ? rows.slice(0, i).findLast((p) => !p.indent) : undefined;
        if (parent?.collapsed) return [];
        if (r.collapsed) {
          const end = rows.findIndex((p, j) => j > i && !p.indent);
          const parts = rows.slice(i + 1, end < 0 ? rows.length : end);
          return [
            {
              label: r.label,
              values: cells(r),
              kind: "toggle",
              parts: parts.map((p) => ({ label: p.label, values: cells(p), nested: true })),
            },
          ];
        }
        if (!r.indent && next?.indent) return [{ label: r.label, values: [], kind: "heading" }];
        if (parent) {
          const part: TableRow = { label: r.label, values: cells(r), nested: true };
          return next?.indent ? [part] : [part, { label: "Total", values: cells(parent), kind: "subtotal" }];
        }
        const prefix = prefixOf(r);
        const before = i > 0 ? prefixOf(rows[i - 1]) : null;
        const after = i + 1 < rows.length ? prefixOf(rows[i + 1]) : null;
        const nested = prefix !== null && (prefix === before || prefix === after);
        const row: TableRow = {
          label: nested ? r.label.slice(prefix.length + 1).trim() : r.label,
          values: cells(r),
          kind: r.kind,
          indent: r.indent,
          nested,
        };
        return nested && prefix !== before ? [{ label: prefix, values: [], kind: "heading" }, row] : [row];
      }),
    })),
  };
}

/** The row whose label starts with `label`, across a table's groups. */
export const findRow = (table: YearTable, label: string): YearRow | undefined =>
  table.groups.flatMap((g) => g.rows).find((r) => r.label.toLowerCase().startsWith(label.toLowerCase()));
