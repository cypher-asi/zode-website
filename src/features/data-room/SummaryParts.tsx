import { Fragment, type ReactElement, type ReactNode } from "react";
import Link from "next/link";
import { CopyButton } from "./CopyButton";
import { ExpandableRows } from "./ExpandableRows";
import { Icon } from "./icons";
import {
  DILIGENCE_FIELDS,
  STATUS_LABELS,
  type DiligenceItem,
  type DiligenceKey,
  type DiligenceSource,
  type DiligenceStatus,
} from "./summary";
import styles from "./Summary.module.css";
import t from "./Tables.module.css";

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function Section({ id, title, action, children }: { id: string; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className={styles.section} aria-labelledby={`${id}-heading`}>
      <div className={styles.sectionHead}>
        <h2 id={`${id}-heading`} className={styles.heading}>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Links that open in the room's browser: a folder, or the summary in it. */
export function FolderLink({
  roomId,
  folderId,
  summary = false,
  children,
}: {
  roomId: string;
  folderId: string;
  summary?: boolean;
  children: ReactNode;
}): ReactElement {
  return (
    <Link
      href={`/portal/data-rooms/${roomId}?folder=${folderId}${summary ? "&summary=1" : ""}`}
      data-folder-id={folderId}
      data-summary={summary ? "" : undefined}
    >
      {children}
    </Link>
  );
}

/** A section's link to the workbook its figures come from, when it's still in the room. */
export function ModelLink({ roomId, fileId, path, live }: { roomId: string; fileId: string; path: string; live: boolean }) {
  if (!live) return null;
  return (
    <Link href={`/portal/data-rooms/${roomId}?file=${fileId}`} data-file-id={fileId} className={styles.modelLink} title={path}>
      Model
      <Icon name="external" />
    </Link>
  );
}

export interface TableRow {
  label: string;
  values: ReactNode[];
  /** A `heading` names the `nested` rows under it and has no values; a `toggle` keeps its values and opens to its `parts`. */
  kind?: "subtotal" | "heading" | "toggle";
  /** Part of the row above it. */
  indent?: boolean;
  nested?: boolean;
  parts?: TableRow[];
}

/** Rows of values under shared column headings. */
export function Table({ head, groups }: { head: string[]; groups: { title?: string; rows: TableRow[] }[] }): ReactElement {
  return (
    <div className={t.scroll}>
      <table className={t.table}>
        <thead>
          <tr>
            <td />
            {head.map((h) => (
              <th key={h} scope="col" className={t.colHead}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((group, g) => (
          <tbody key={group.title || g}>
            {group.title ? (
              <tr className={t.groupRow}>
                <th scope="colgroup" colSpan={head.length + 1}>
                  {group.title}
                </th>
              </tr>
            ) : null}
            {group.rows.map((row, r) =>
              row.kind === "toggle" ? (
                <ExpandableRows key={`${r}:${row.label}`} row={row} />
              ) : row.kind === "heading" ? (
                <tr key={`${r}:${row.label}`} className={t.heading}>
                  <th scope="rowgroup" colSpan={head.length + 1}>
                    {row.label}
                  </th>
                </tr>
              ) : (
                <tr
                  key={`${r}:${row.label}`}
                  className={
                    [row.kind === "subtotal" ? t.subtotal : row.indent ? t.indent : null, row.nested ? t.nested : null]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                >
                  <th scope="row">{row.label}</th>
                  {row.values.map((v, i) => (
                    <td key={i}>{v}</td>
                  ))}
                </tr>
              ),
            )}
          </tbody>
        ))}
      </table>
    </div>
  );
}

/** Diligence rows lead with what the room confirms. */
const STATUS_ORDER: DiligenceStatus[] = ["confirmed", "claimed", "gap", "risk"];

const STATUS_HINTS: Record<DiligenceStatus, string> = {
  confirmed: "Rests on records in the room",
  claimed: "On the seller's word",
  gap: "Nothing in the room either way",
  risk: "A known concern",
};

export interface DiligenceRow {
  key: DiligenceKey;
  label: string;
  item: DiligenceItem;
}

/** The answers in display order, confirmed first. */
export const diligenceRows = (diligence: Partial<Record<DiligenceKey, DiligenceItem>>): DiligenceRow[] =>
  DILIGENCE_FIELDS.flatMap(({ key, label }) => {
    const item = diligence[key];
    return item ? [{ key, label, item }] : [];
  }).sort((a, b) => STATUS_ORDER.indexOf(a.item.status) - STATUS_ORDER.indexOf(b.item.status));

/** "3 of 8 confirmed. 3 risks and 2 gaps to resolve." */
export function diligenceLede(statuses: DiligenceStatus[]): string {
  const count = (status: DiligenceStatus) => statuses.filter((s) => s === status).length;
  const confirmed = count("confirmed");
  if (confirmed === statuses.length) return `All ${statuses.length} confirmed.`;
  const open = [
    count("risk") && plural(count("risk"), "risk", "risks"),
    count("gap") && plural(count("gap"), "gap", "gaps"),
  ].filter(Boolean);
  const claimed = count("claimed");
  return [
    `${confirmed} of ${statuses.length} confirmed.`,
    open.length ? `${open.join(" and ")} to resolve.` : "",
    claimed ? `${claimed} on the seller's word.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * The diligence answers as plain text, in display order: each item's status,
 * headline and reasoning, then the files it cites by name and room path.
 */
export function diligenceText(items: DiligenceRow[], names: Map<string, string>, title = "Diligence"): string {
  const blocks = items.map(({ label, item }) => {
    const files = item.sources.map((source) => {
      const name = names.get(source.fileId);
      return name
        ? `- ${name} (${source.path})`
        : `- ${source.path.split("/").pop()} (${source.path}, no longer in the room)`;
    });
    return [
      `${label}: ${STATUS_LABELS[item.status]}`,
      item.headline,
      item.detail.replace(/\*\*(.+?)\*\*/g, "$1").trim(),
      files.length ? `Files:\n${files.join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });
  return [title, diligenceLede(items.map(({ item }) => item.status)), ...blocks].join("\n\n");
}

/** `**bold**` spans; everything else stays plain text. */
function inline(text: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));
}

/**
 * A summary's reasoning: blank lines separate paragraphs, and lines starting
 * with "- " form a list, optionally under a lead-in line.
 */
export function Prose({ text }: { text: string }) {
  const blocks = text
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .filter((lines) => lines.length);
  return (
    <div className={styles.detail}>
      {blocks.map((lines, i) => {
        const isItem = (line: string) => line.startsWith("- ");
        const lead = isItem(lines[0]) ? null : lines[0];
        const rest = lead === null ? lines : lines.slice(1);
        if (!rest.length || !rest.every(isItem)) return <p key={i}>{inline(lines.join(" "))}</p>;
        return (
          <Fragment key={i}>
            {lead === null ? null : <p>{inline(lead)}</p>}
            <ul>
              {rest.map((line, j) => (
                <li key={j}>{inline(line.slice(2))}</li>
              ))}
            </ul>
          </Fragment>
        );
      })}
    </div>
  );
}

export function Sources({
  roomId,
  sources,
  names,
}: {
  roomId: string;
  sources: DiligenceSource[];
  names: Map<string, string>;
}) {
  if (!sources.length) return null;
  return (
    <ul className={styles.sources} aria-label="Sources">
      {sources.map((source) => {
        const name = names.get(source.fileId);
        return (
          <li key={source.fileId}>
            {name ? (
              <Link
                href={`/portal/data-rooms/${roomId}?file=${source.fileId}`}
                title={source.path}
                data-file-id={source.fileId}
              >
                {name}
              </Link>
            ) : (
              <span className={styles.gone} title="No longer in the room">
                {source.path.split("/").pop()}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export interface KeyFigure {
  label: string;
  value: string;
  estimate?: boolean;
}

/** Headline numbers in a grid, largest type on the page after the headings. */
export function KeyFigures({ figures }: { figures: KeyFigure[] }) {
  return (
    <ul className={styles.keyFigures} data-count={figures.length}>
      {figures.map((f) => (
        <li key={f.label} className={styles.keyFigure}>
          <span className={styles.keyValue}>{f.value}</span>
          <span className={styles.keyLabel}>
            {f.label}
            {f.estimate ? <span className={styles.est}> · est.</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

export interface Figure {
  label: string;
  value: string;
  /** A few words under the label; the full reasoning is in `detail`. */
  note?: string;
  detail: string;
  estimate?: boolean;
  sources?: DiligenceSource[];
}

export interface Term {
  label: string;
  value: string;
  note?: string;
  estimate?: boolean;
}

/** Label and value rows under a group heading. */
export function TermGroup({ title, terms }: { title: string; terms: Term[] }): ReactElement {
  return (
    <div className={styles.dealGroup}>
      <h3 className={styles.groupHeading}>{title}</h3>
      <dl className={styles.terms}>
        {terms.map((t) => (
          <div key={t.label} className={styles.term}>
            <dt className={styles.termLabel}>
              <span>
                {t.label}
                {t.estimate ? <span className={styles.est}> · est.</span> : null}
              </span>
              {t.note ? <span className={styles.termNote}>{t.note}</span> : null}
            </dt>
            <dd className={styles.termValue}>{t.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Groups of label and value rows, with each figure's reasoning and sources behind a disclosure. */
export function TermGroups({
  id,
  title,
  lede,
  groups,
  notes,
  roomId,
  names,
}: {
  id: string;
  title: string;
  lede?: string;
  groups: { title: string; terms: Term[] }[];
  notes: Figure[];
  roomId: string;
  names: Map<string, string>;
}) {
  return (
    <section className={styles.section} aria-labelledby={`${id}-heading`}>
      <div className={styles.sectionHead}>
        <h2 id={`${id}-heading`} className={styles.heading}>
          {title}
        </h2>
      </div>
      {lede ? <p className={styles.lede}>{lede}</p> : null}
      <div className={styles.dealGroups}>
        {groups.map((group) => (
          <TermGroup key={group.title} title={group.title} terms={group.terms} />
        ))}
      </div>
      <details className={styles.more}>
        <summary className={styles.moreHead}>
          Terms and sources
          <Icon name="chevron" className={styles.chevron} />
        </summary>
        <ul className={styles.figures}>
          {notes.map((f) => (
            <li key={f.label} className={styles.figure}>
              <div className={styles.figureHead}>
                <span className={styles.figureLabel}>
                  {f.label}
                  {f.estimate ? <span className={styles.estimate}>Estimate</span> : null}
                  {f.note ? <span className={styles.figureNote}>{f.note}</span> : null}
                </span>
                <span className={styles.figureValue}>{f.value}</span>
              </div>
              <Prose text={f.detail} />
              {f.sources?.length ? <Sources roomId={roomId} sources={f.sources} names={names} /> : null}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

/** One quiet line per answer, each opening to its headline, reasoning and sources. */
export function DiligenceList({
  roomId,
  items,
  names,
}: {
  roomId: string;
  items: DiligenceRow[];
  names: Map<string, string>;
}): ReactElement {
  return (
    <ul className={styles.list}>
      {items.map(({ key, label, item }) => (
        <li key={key}>
          <details className={styles.row}>
            <summary className={styles.rowHead}>
              <span className={styles.dot} data-status={item.status} aria-hidden="true" />
              <span className={styles.rowLabel}>{label}</span>
              <span className={styles.status} data-status={item.status} title={STATUS_HINTS[item.status]}>
                {STATUS_LABELS[item.status]}
              </span>
              <Icon name="chevron" className={styles.chevron} />
            </summary>
            <div className={styles.rowBody}>
              <p className={styles.headline}>{item.headline}</p>
              <Prose text={item.detail} />
              <Sources roomId={roomId} sources={item.sources} names={names} />
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}

/** The Diligence section's heading row: its title and a Copy button for every answer. */
export function DiligenceHead({
  id,
  title,
  items,
  names,
}: {
  id: string;
  title: string;
  items: DiligenceRow[];
  names: Map<string, string>;
}): ReactElement {
  return (
    <div className={styles.sectionHead}>
      <h2 id={id} className={styles.heading}>
        {title}
      </h2>
      <CopyButton text={diligenceText(items, names, title)} label={title.toLowerCase()} />
    </div>
  );
}
