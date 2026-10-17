"use client";

import { useEffect, useId, useState, type ReactElement } from "react";
import { Scrollbars } from "./Scrollbars";
import { fetchFile, type ViewerProps } from "./types";
import styles from "../Viewer.module.css";

const MAX_ROWS = 2000;
const MAX_COLUMNS = 200;

interface Sheet {
  name: string;
  rows: string[][];
  totalRows: number;
}

const dateOnly = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const dateTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

function display(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) {
    return value.getUTCHours() || value.getUTCMinutes() ? dateTime.format(value) : dateOnly.format(value);
  }
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return String(value);
}

function columnName(index: number): string {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return name;
}

/** Excel workbooks as plain grids, one tab per sheet. Values only: formatting and charts aren't shown. */
export default function SheetViewer({ url, zoom, onFitScale }: ViewerProps): ReactElement {
  const [sheets, setSheets] = useState<Sheet[] | null>(null);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const scrollId = useId();

  useEffect(() => onFitScale(1), [onFitScale]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const [{ default: readXlsxFile }, buffer] = await Promise.all([
          import("read-excel-file/browser"),
          fetchFile(url, controller.signal),
        ]);
        const workbook = await readXlsxFile(buffer);
        if (controller.signal.aborted) return;
        setSheets(
          workbook.map(({ sheet, data }) => ({
            name: sheet,
            totalRows: data.length,
            rows: data.slice(0, MAX_ROWS).map((row) => row.slice(0, MAX_COLUMNS).map(display)),
          })),
        );
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error && err.message.includes("no longer available")
              ? err.message
              : "This workbook couldn't be previewed. Download it to open it in Excel.",
          );
        }
      }
    })();
    return () => controller.abort();
  }, [url]);

  if (error) return <div className={styles.status}>{error}</div>;
  if (!sheets) return <div className={styles.status}>Loading workbook…</div>;

  const sheet = sheets[Math.min(active, sheets.length - 1)];
  const columns = sheet ? Math.max(0, ...sheet.rows.map((row) => row.length)) : 0;
  const scale = zoom === "fit" ? 1 : zoom;

  return (
    <div className={styles.sheet}>
      <div className={styles.sheetFrame}>
        <div id={scrollId} className={styles.sheetGrid} style={{ zoom: scale }}>
          {sheet && sheet.totalRows > MAX_ROWS ? (
            <p className={styles.note}>
              Showing the first {MAX_ROWS.toLocaleString("en-US")} of {sheet.totalRows.toLocaleString("en-US")} rows.
            </p>
          ) : null}
          {sheet && sheet.rows.length ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th aria-hidden="true" />
                  {Array.from({ length: columns }, (_, i) => (
                    <th key={i} scope="col">
                      {columnName(i)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.rows.map((row, i) => (
                  <tr key={i}>
                    <th scope="row">{i + 1}</th>
                    {Array.from({ length: columns }, (_, j) => (
                      <td key={j}>{row[j] ?? ""}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className={styles.note}>This sheet is empty.</p>
          )}
        </div>
        <Scrollbars targetId={scrollId} />
      </div>
      {sheets.length > 1 ? (
        <div className={styles.sheetTabs} role="tablist" aria-label="Sheets">
          {sheets.map((s, i) => (
            <button
              key={`${s.name}-${i}`}
              type="button"
              role="tab"
              aria-selected={i === active}
              className={styles.sheetTab}
              onClick={() => setActive(i)}
            >
              {s.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
