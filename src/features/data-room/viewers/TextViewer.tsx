"use client";

import { useEffect, useId, useState, type ReactElement } from "react";
import { extensionOf, fileKind, formatBytes } from "../fileKinds";
import { Scrollbars } from "./Scrollbars";
import { fetchFile, type ViewerProps } from "./types";
import styles from "../Viewer.module.css";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5000;

/** RFC 4180 fields: quoted values may hold delimiters, newlines and doubled quotes. */
function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length && rows.length < MAX_ROWS; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field === "") {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) rows.push([...row, field]);
  return rows;
}

type Content = { kind: "table"; rows: string[][] } | { kind: "text"; text: string };

/** Plain text, pretty-printed JSON, or CSV/TSV as a table; zoom scales the type. */
export default function TextViewer({ url, file, zoom, onFitScale }: ViewerProps): ReactElement {
  const [content, setContent] = useState<Content | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollId = useId();
  const truncated = file.sizeBytes > MAX_BYTES;

  useEffect(() => onFitScale(1), [onFitScale]);

  useEffect(() => {
    const controller = new AbortController();
    fetchFile(url, controller.signal)
      .then((buffer) => {
        const text = new TextDecoder().decode(buffer.slice(0, MAX_BYTES));
        const ext = extensionOf(file.name);
        if (fileKind(file.name) === "csv") {
          setContent({ kind: "table", rows: parseDelimited(text, ext === "tsv" ? "\t" : ",") });
        } else if (ext === "json") {
          try {
            setContent({ kind: "text", text: JSON.stringify(JSON.parse(text), null, 2) });
          } catch {
            setContent({ kind: "text", text });
          }
        } else {
          setContent({ kind: "text", text });
        }
      })
      .catch((err: Error) => {
        if (!controller.signal.aborted) setError(err.message);
      });
    return () => controller.abort();
  }, [url, file.name]);

  if (error) return <div className={styles.status}>{error}</div>;
  if (!content) return <div className={styles.status}>Loading…</div>;

  const scale = zoom === "fit" ? 1 : zoom;
  const note =
    truncated || (content.kind === "table" && content.rows.length >= MAX_ROWS)
      ? `Showing the start of this ${formatBytes(file.sizeBytes)} file. Download it to see everything.`
      : null;

  return (
    <>
      <div id={scrollId} className={styles.text} style={{ fontSize: `${13 * scale}px` }}>
        {note ? <p className={styles.note}>{note}</p> : null}
        {content.kind === "text" ? (
          <pre className={styles.pre}>{content.text}</pre>
        ) : (
          <table className={styles.table}>
            <tbody>
              {content.rows.map((row, i) => (
                <tr key={i}>
                  <th scope="row">{i + 1}</th>
                  {row.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Scrollbars targetId={scrollId} />
    </>
  );
}
