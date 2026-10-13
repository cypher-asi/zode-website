import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import { METRIC_DEFINITIONS, type MetricId } from "./definitions";
import styles from "./analytics.module.css";

export interface Column<S extends string> {
  id: S;
  label: string;
  /** Its definition, shown on hover. */
  metric?: MetricId;
}

export interface TableRow {
  key: string;
  cells: ReactNode[];
}

/**
 * A full report: sortable by any column through links, so the sort is part
 * of the URL, and paged when it outgrows a page.
 */
export function ReportTable<S extends string>({
  columns,
  rows,
  sort,
  dir,
  sortHref,
  page,
  pageSize,
  total,
  pageHref,
  empty = "Nothing in this range yet.",
}: {
  columns: Column<S>[];
  rows: TableRow[];
  sort: S;
  dir: "asc" | "desc";
  /** The link that sorts by a column; a second click flips the direction. */
  sortHref: (column: S, dir: "asc" | "desc") => string;
  page: number;
  pageSize: number;
  total: number;
  pageHref: (page: number) => string;
  empty?: string;
}): ReactElement {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((column, i) => {
                const active = column.id === sort;
                const next = active ? (dir === "desc" ? "asc" : "desc") : i === 0 ? "asc" : "desc";
                return (
                  <th
                    key={column.id}
                    scope="col"
                    aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
                    title={column.metric ? METRIC_DEFINITIONS[column.metric].description : undefined}
                  >
                    <Link className={styles.sortLink} href={sortHref(column.id, next)} scroll={false}>
                      {column.label}
                    </Link>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.key}>
                  {row.cells.map((cell, i) => (
                    <td key={i}>{cell}</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td className={styles.muted} colSpan={columns.length}>
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {total > pageSize ? (
        <div className={styles.pager}>
          <span>
            {(page * pageSize + 1).toLocaleString("en-US")}–{Math.min(total, (page + 1) * pageSize).toLocaleString("en-US")} of{" "}
            {total.toLocaleString("en-US")}
          </span>
          <span className={styles.pagerLinks}>
            <Link className={styles.pagerLink} href={pageHref(page - 1)} aria-disabled={page === 0} scroll={false}>
              Previous
            </Link>
            <Link className={styles.pagerLink} href={pageHref(page + 1)} aria-disabled={page >= pages - 1} scroll={false}>
              Next
            </Link>
          </span>
        </div>
      ) : null}
    </>
  );
}
