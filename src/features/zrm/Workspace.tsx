"use client";

import { memo, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactElement, type ReactNode } from "react";
import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { Splitter } from "@/components/ui/Splitter";
import { PortalLoading } from "@/features/portal/PortalLoading";
import ui from "@/features/data-room/ui.module.css";
import { Icon } from "./bits";
import { NEW_LABELS, companiesConfig, opportunitiesConfig, peopleConfig, type ListConfig } from "./columns";
import { KIND_LABELS, isKind, recordHref, type ZrmKind, type ZrmType } from "./types";
import { goOnClick, useZrm, ZrmLink } from "./ZrmProvider";
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

interface RowProps<T> {
  kind: ZrmKind;
  row: T;
  config: ListConfig<T>;
  style: CSSProperties;
  selected: boolean;
  go: (href: string) => void;
}

/** One record in the list, memoized so moving the selection re-renders only the rows it leaves and lands on. */
const Row = memo(function Row<T extends ListRow>({ kind, row, config, style, selected, go }: RowProps<T>): ReactElement {
  const href = recordHref(kind, row.id);
  return (
    <Link
      data-id={row.id}
      href={href}
      scroll={false}
      prefetch={false}
      onClick={goOnClick(go, href)}
      className={styles.row}
      style={style}
      aria-current={selected ? "page" : undefined}
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
  );
}) as <T extends ListRow>(props: RowProps<T>) => ReactElement;

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
  const { go } = useZrm();
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

  const columnsStyle = useMemo(
    () =>
      ({
        "--columns": config.columns.map((c) => c.width).join(" "),
        "--columns-narrow": config.columns
          .filter((c) => !c.wideOnly)
          .map((c) => c.width)
          .join(" "),
      }) as CSSProperties,
    [config],
  );

  const toggleSort = (key: string) =>
    setSort((current) => (current?.key !== key ? { key, dir: 1 } : current.dir === 1 ? { key, dir: -1 } : null));

  /** Up and down move the selection through the list. */
  const onKeyDown = (event: KeyboardEvent) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (!step || shown.length === 0) return;
    event.preventDefault();
    const at = shown.findIndex((row) => row.id === selectedId);
    const next = shown[Math.min(shown.length - 1, Math.max(0, at === -1 ? 0 : at + step))]!;
    go(recordHref(kind, next.id));
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
        <ZrmLink href={`/portal/zrm/${kind}/new`} className={ui.primary} aria-label={NEW_LABELS[kind]} title={NEW_LABELS[kind]}>
          <Icon name="plus" />
          New
        </ZrmLink>
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
            <Row
              key={row.id}
              kind={kind}
              row={row}
              config={config}
              style={columnsStyle}
              selected={row.id === selectedId}
              go={go}
            />
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
 * The open ZRM tab: the list of records, and once one is open (or the New
 * form), a resizable divider and the record (the route's page) on the right.
 * Lives in the ZRM layout and lists from data already loaded, so switching
 * tabs shows the new list at once, and moving between records keeps the
 * list, its search and its scroll.
 */
export function Workspace({ children }: { children: ReactNode }): ReactElement {
  const { data, segments, pending } = useZrm();
  const [kind, child = null] = segments;
  const shownChild = useSelectedLayoutSegments()[1] ?? null;
  /** On its way to another record or form: an empty pane shows a placeholder, an open record dims until it's replaced. */
  const loading = pending && child !== shownChild;
  const containerRef = useRef<HTMLDivElement>(null);
  const configs = useMemo(() => {
    const typeMap = new Map(data.types.map((type) => [type.id, type]));
    return { people: peopleConfig(typeMap), companies: companiesConfig(typeMap), opportunities: opportunitiesConfig() };
  }, [data.types]);

  if (!isKind(kind)) return <>{children}</>;

  const common = { types: data.types, selectedId: child && child !== "new" ? child : null };
  let list: ReactElement;
  switch (kind) {
    case "people":
      list = <RecordList key={kind} kind={kind} rows={data.people} config={configs.people} {...common} />;
      break;
    case "companies":
      list = <RecordList key={kind} kind={kind} rows={data.companies} config={configs.companies} {...common} />;
      break;
    case "opportunities":
      list = <RecordList key={kind} kind={kind} rows={data.opportunities} config={configs.opportunities} {...common} />;
      break;
  }

  return (
    <div ref={containerRef} className={styles.workspace} data-view={child ? "detail" : "list"}>
      <section className={styles.listPane} aria-label={KIND_LABELS[kind].plural}>
        {list}
      </section>
      {child ? (
        <>
          <Splitter
            containerRef={containerRef}
            storageKey="zode:zrm:list-share"
            label="Resize list"
            cssVar="--list-width"
            defaultFraction={0.52}
          />
          <section
            className={styles.detailPane}
            aria-label="Details"
            aria-busy={loading || undefined}
            data-pending={loading && shownChild ? "" : undefined}
          >
            {loading && !shownChild ? <PortalLoading header={false} /> : children}
          </section>
        </>
      ) : null}
    </div>
  );
}
