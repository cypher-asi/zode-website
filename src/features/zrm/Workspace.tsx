"use client";

import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactElement, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { Splitter } from "@/components/ui/Splitter";
import ui from "@/features/data-room/ui.module.css";
import { Icon } from "./bits";
import { NEW_LABELS, companiesConfig, opportunitiesConfig, peopleConfig, type ListConfig } from "./columns";
import { KIND_LABELS, recordHref, type ListRows, type ZrmKind, type ZrmType } from "./types";
import styles from "./zrm.module.css";

interface Sort {
  key: string;
  dir: 1 | -1;
}

interface ListRow {
  id: string;
  active: boolean;
  type_ids: string[];
}

function compare(a: string | number | null, b: string | number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}

/** The middle pane: search, a type filter and sortable columns over the records, pinned ones first. */
function RecordList<T extends ListRow>({
  kind,
  rows,
  config,
  types,
  selectedId,
}: {
  kind: ZrmKind;
  rows: readonly T[];
  config: ListConfig<T>;
  types: readonly ZrmType[];
  selectedId: string | null;
}): ReactElement {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [typeId, setTypeId] = useState("");
  const [sort, setSort] = useState<Sort | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const typeOptions = useMemo(() => {
    const used = new Set(rows.flatMap((row) => row.type_ids));
    return [
      { value: "", label: "All types" },
      ...types.filter((type) => used.has(type.id)).map((type) => ({ value: type.id, label: type.name })),
    ];
  }, [rows, types]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = rows.filter(
      (row) => (!typeId || row.type_ids.includes(typeId)) && (!needle || config.searchText(row).includes(needle)),
    );
    const column = sort ? config.columns.find((c) => c.key === sort.key) : undefined;
    return filtered
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        if (a.row.active !== b.row.active) return a.row.active ? -1 : 1;
        if (column?.sortValue && sort) {
          const order = compare(column.sortValue(a.row), column.sortValue(b.row));
          if (order !== 0) return order * sort.dir;
        }
        return a.index - b.index;
      })
      .map(({ row }) => row);
  }, [rows, query, typeId, sort, config]);

  const columnsStyle = {
    "--columns": config.columns.map((c) => c.width).join(" "),
    "--columns-narrow": config.columns
      .filter((c) => !c.wideOnly)
      .map((c) => c.width)
      .join(" "),
  } as CSSProperties;

  const toggleSort = (key: string) =>
    setSort((current) => (current?.key !== key ? { key, dir: 1 } : current.dir === 1 ? { key, dir: -1 } : null));

  /** Up and down move the selection through the list. */
  const onKeyDown = (event: KeyboardEvent) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (!step || shown.length === 0) return;
    event.preventDefault();
    const at = shown.findIndex((row) => row.id === selectedId);
    const next = shown[Math.min(shown.length - 1, Math.max(0, at === -1 ? 0 : at + step))]!;
    router.push(recordHref(kind, next.id), { scroll: false });
    listRef.current?.querySelector<HTMLElement>(`[data-id="${next.id}"]`)?.focus();
  };

  const [singular, plural] = config.noun;

  return (
    <>
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Icon name="search" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${KIND_LABELS[kind].plural.toLowerCase()}`}
            aria-label={`Search ${KIND_LABELS[kind].plural.toLowerCase()}`}
          />
        </label>
        {typeOptions.length > 1 ? (
          <Select
            size="sm"
            className={styles.filter}
            options={typeOptions}
            value={typeId}
            onChange={setTypeId}
            aria-label="Filter by type"
            align="end"
          />
        ) : null}
        <Link href={`/portal/zrm/${kind}/new`} className={ui.primary} aria-label={NEW_LABELS[kind]} title={NEW_LABELS[kind]}>
          <Icon name="plus" />
          New
        </Link>
      </div>

      <div className={styles.head} style={columnsStyle}>
        {config.columns.map((column) => (
          <span key={column.key} data-align={column.align} data-wide-only={column.wideOnly ? "" : undefined}>
            {column.sortValue ? (
              <button
                type="button"
                className={styles.sort}
                onClick={() => toggleSort(column.key)}
                aria-sort={sort?.key === column.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}
                aria-label={`Sort by ${column.header}`}
              >
                {column.header}
                {sort?.key === column.key ? <Icon name="sort" /> : null}
              </button>
            ) : (
              column.header
            )}
          </span>
        ))}
      </div>

      <div ref={listRef} className={styles.rows} onKeyDown={onKeyDown}>
        {shown.length === 0 ? (
          <p className={styles.empty}>
            {rows.length === 0 ? `No ${plural} yet.` : `No ${plural} match.`}
          </p>
        ) : (
          shown.map((row) => (
            <Link
              key={row.id}
              data-id={row.id}
              href={recordHref(kind, row.id)}
              scroll={false}
              className={styles.row}
              style={columnsStyle}
              aria-current={row.id === selectedId ? "page" : undefined}
            >
              {config.columns.map((column) => (
                <span
                  key={column.key}
                  className={column.key === config.columns[0]!.key ? styles.lead : styles.cell}
                  data-align={column.align}
                  data-numeric={column.align === "end" ? "" : undefined}
                  data-wide-only={column.wideOnly ? "" : undefined}
                >
                  {column.render(row)}
                </span>
              ))}
            </Link>
          ))
        )}
      </div>

      <div className={styles.footer}>
        <span>
          {shown.length === rows.length
            ? `${rows.length} ${rows.length === 1 ? singular : plural}`
            : `${shown.length} of ${rows.length} ${plural}`}
        </span>
        {config.summary ? <span>{config.summary(shown)}</span> : null}
      </div>
    </>
  );
}

/**
 * One ZRM tab: the list of records in the middle, a resizable divider, and
 * the open record (the route's page) on the right. Lives in the tab's layout,
 * so moving between records keeps the list, its search and its scroll.
 */
export function Workspace({ data, types, children }: { data: ListRows; types: ZrmType[]; children: ReactNode }): ReactElement {
  const segment = useSelectedLayoutSegment();
  const containerRef = useRef<HTMLDivElement>(null);
  const typeMap = useMemo(() => new Map(types.map((type) => [type.id, type])), [types]);
  const selectedId = segment && segment !== "new" ? segment : null;
  const common = { types, selectedId };

  let list: ReactElement;
  switch (data.kind) {
    case "people":
      list = <RecordList kind="people" rows={data.rows} config={peopleConfig(typeMap)} {...common} />;
      break;
    case "companies":
      list = <RecordList kind="companies" rows={data.rows} config={companiesConfig(typeMap)} {...common} />;
      break;
    case "opportunities":
      list = <RecordList kind="opportunities" rows={data.rows} config={opportunitiesConfig()} {...common} />;
      break;
  }

  return (
    <div ref={containerRef} className={styles.workspace} data-view={segment ? "detail" : "list"}>
      <section className={styles.listPane} aria-label={KIND_LABELS[data.kind].plural}>
        {list}
      </section>
      <Splitter
        containerRef={containerRef}
        storageKey="zode:zrm:list-share"
        label="Resize list"
        cssVar="--list-width"
        defaultFraction={0.52}
      />
      <section className={styles.detailPane} aria-label="Details">
        {children}
      </section>
    </div>
  );
}
