"use client";

import {
  Fragment,
  memo,
  startTransition,
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { Splitter } from "@/components/ui/Splitter";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { deleteRecordAction, saveFieldAction, setActiveAction, setSiteFieldAction, setStageAction } from "./actions";
import { Icon } from "./bits";
import { companiesConfig, opportunitiesConfig, peopleConfig, sitesConfig, type ListConfig } from "./columns";
import { DealTypeNav } from "./DealTypeNav";
import { clearedColumns } from "./fields";
import { OpportunityMenu } from "./OpportunityMenu";
import { SiteMenu } from "./SiteMenu";
import { StatusNav } from "./StatusNav";
import { KIND_LABELS, isOpportunityKind, recordHref, type OpportunityKind, type OpportunityRow, type RecordKind } from "./types";
import { TypeNav } from "./TypeNav";
import { goOnClick, useZrmData, useZrmNavigate, useZrmRoute } from "./ZrmProvider";
import styles from "./zrm.module.css";

interface Sort {
  key: string;
  dir: 1 | -1;
}

interface ListRow {
  id: string;
  active: boolean;
}

/** A dragged list row. Same-document only; the id is also on the row's `data-id`. */
const DRAG_TYPE = "application/x-zode-zrm-row";

function compare(a: string | number | null, b: string | number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}

interface RowProps<T> {
  kind: RecordKind;
  row: T;
  config: ListConfig<T>;
  style: CSSProperties;
  selected: boolean;
  go: (href: string) => void;
  prefetch: (href: string) => void;
  /** Opens the row's menu at a point in the window, on right-click or the keyboard's menu key. */
  onMenu?: (row: T, x: number, y: number) => void;
  menuOpen?: boolean;
  /** The row can be dragged onto a section. */
  draggable?: boolean;
  onDragEnd?: () => void;
}

/**
 * One record in the list, memoized so moving the selection re-renders only the
 * rows it leaves and lands on. Prefetched on hover or focus rather than as it
 * scrolls into view, as a list can hold thousands.
 */
const Row = memo(function Row<T extends ListRow>({
  kind,
  row,
  config,
  style,
  selected,
  go,
  prefetch,
  onMenu,
  menuOpen,
  draggable,
  onDragEnd,
}: RowProps<T>): ReactElement {
  const href = recordHref(kind, row.id);
  const dragged = useRef(false);
  return (
    <Link
      data-id={row.id}
      href={href}
      scroll={false}
      prefetch={false}
      draggable={Boolean(draggable)}
      onMouseEnter={() => prefetch(href)}
      onFocus={() => prefetch(href)}
      onClick={(event) => {
        if (dragged.current) {
          dragged.current = false;
          event.preventDefault();
          return;
        }
        goOnClick(go, href)(event);
      }}
      onDragStart={
        draggable
          ? (event) => {
              dragged.current = true;
              event.currentTarget.setAttribute("data-dragging", "");
              event.dataTransfer.setData(DRAG_TYPE, row.id);
              event.dataTransfer.effectAllowed = "move";
            }
          : undefined
      }
      onDragEnd={
        draggable
          ? (event) => {
              event.currentTarget.removeAttribute("data-dragging");
              onDragEnd?.();
              window.setTimeout(() => {
                dragged.current = false;
              }, 0);
            }
          : undefined
      }
      onContextMenu={
        onMenu
          ? (event: MouseEvent<HTMLAnchorElement>) => {
              event.preventDefault();
              onMenu(row, event.clientX, event.clientY);
            }
          : undefined
      }
      onKeyDown={
        onMenu
          ? (event: KeyboardEvent<HTMLAnchorElement>) => {
              if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
              event.preventDefault();
              const box = event.currentTarget.getBoundingClientRect();
              onMenu(row, box.left + 24, box.bottom);
            }
          : undefined
      }
      className={styles.row}
      style={style}
      aria-current={selected ? "page" : undefined}
      aria-haspopup={onMenu ? "menu" : undefined}
      data-menu-open={menuOpen ? "" : undefined}
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

/**
 * The middle pane: search, the config's filters and sortable columns over the
 * records, pinned ones first, under section headings and over section totals
 * while unsorted when the config has them.
 */
function RecordList<T extends ListRow>({
  kind,
  rows,
  config,
  selectedId,
  filterValues,
  onFilterChange,
  onRowMenu,
  menuRowId,
  onMove,
}: {
  kind: RecordKind;
  rows: readonly T[];
  config: ListConfig<T>;
  selectedId: string | null;
  filterValues: Readonly<Record<string, string>>;
  onFilterChange: (key: string, value: string) => void;
  onRowMenu?: (row: T, x: number, y: number) => void;
  menuRowId?: string | null;
  /** Drops a row onto a section. Set for lists whose sections declare every group. */
  onMove?: (row: T, sectionKey: string) => void;
}): ReactElement {
  const { go, prefetch } = useZrmNavigate();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const deferredFilterValues = useDeferredValue(filterValues);
  const [sort, setSort] = useState<Sort | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const endDrag = useCallback(() => setDropKey(null), []);

  const searchTexts = useMemo(() => rows.map((row) => config.searchText(row)), [rows, config]);

  const filters = useMemo(
    () =>
      (config.filters ?? []).map((filter) => ({ filter, options: [{ value: "", label: filter.all }, ...filter.options(rows)] })),
    [config, rows],
  );

  const sections = sort ? undefined : config.sections;
  const totaled = sections !== undefined && config.columns.some((column) => column.total);

  const shown = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    const filtered = rows.filter(
      (row, at) =>
        (config.filters ?? []).every(
          (filter) => !deferredFilterValues[filter.key] || filter.test(row, deferredFilterValues[filter.key]!),
        ) &&
        (!needle || searchTexts[at]!.includes(needle)),
    );
    const column = sort ? config.columns.find((c) => c.key === sort.key) : undefined;
    return filtered
      .map((row, index) => ({ row, index, section: sections?.of(row).order ?? 0 }))
      .sort((a, b) => {
        if (a.section !== b.section) return a.section - b.section;
        if (a.row.active !== b.row.active) return a.row.active ? -1 : 1;
        if (column?.sortValue && sort) {
          const order = compare(column.sortValue(a.row), column.sortValue(b.row));
          if (order !== 0) return order * sort.dir;
        }
        return a.index - b.index;
      })
      .map(({ row }) => row);
  }, [rows, searchTexts, deferredQuery, deferredFilterValues, sort, sections, config]);

  /**
   * The shown rows split at each change of section, or one untitled run without
   * sections. A list that declares every section keeps the empty ones, in order,
   * and any row whose section is no longer declared.
   */
  const runs = useMemo(() => {
    if (!sections) return [{ key: "", label: null as string | null, rows: shown }];
    if (!sections.all) {
      const out: { key: string; label: string | null; rows: T[] }[] = [];
      for (const row of shown) {
        const section = sections.of(row);
        const last = out.at(-1);
        if (last?.key === section.key) last.rows.push(row);
        else out.push({ key: section.key, label: section.label, rows: [row] });
      }
      return out;
    }
    const out = [...sections.all]
      .sort((a, b) => a.order - b.order)
      .map((section) => ({ key: section.key, label: section.label as string | null, rows: [] as T[] }));
    const byKey = new Map(out.map((run) => [run.key, run]));
    for (const row of shown) {
      const section = sections.of(row);
      const run = byKey.get(section.key);
      if (run) {
        run.rows.push(row);
        continue;
      }
      const extra = { key: section.key, label: section.label, rows: [row] };
      byKey.set(section.key, extra);
      out.push(extra);
    }
    return out;
  }, [shown, sections]);

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
        <div className={styles.search}>
          <label className={styles.searchField}>
            <Icon name="search" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${KIND_LABELS[kind].plural.toLowerCase()}`}
              aria-label={`Search ${KIND_LABELS[kind].plural.toLowerCase()}`}
            />
          </label>
        </div>
        {filters.map(({ filter, options }) => (
          <Select
            key={filter.key}
            size="sm"
            className={filter.sidebar ? `${styles.filter} ${styles.sidebarFilter}` : styles.filter}
            options={options}
            value={filterValues[filter.key] ?? ""}
            onChange={(value) => onFilterChange(filter.key, value)}
            disabled={options.length < 2}
            aria-label={filter.label}
            align="end"
          />
        ))}
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
        {shown.length === 0 && !sections?.all?.length ? (
          <p className={styles.empty}>
            {rows.length === 0 ? `No ${plural} yet.` : `No ${plural} match.`}
          </p>
        ) : (
          runs.map((run) => {
            const droppable = Boolean(onMove) && run.label !== null;
            const body = (
              <>
                {run.label !== null ? <div className={styles.sectionRow}>{run.label}</div> : null}
                {run.rows.map((row) => (
                  <Row
                    key={row.id}
                    kind={kind}
                    row={row}
                    config={config}
                    style={columnsStyle}
                    selected={row.id === selectedId}
                    go={go}
                    prefetch={prefetch}
                    onMenu={onRowMenu}
                    menuOpen={row.id === menuRowId}
                    draggable={droppable}
                    onDragEnd={endDrag}
                  />
                ))}
                {run.rows.length === 0 && run.label !== null ? <div className={styles.sectionEmpty} /> : null}
                {totaled && run.rows.length > 0 ? (
                  <div className={`${styles.row} ${styles.totalRow}`} style={columnsStyle}>
                    {config.columns.map((column) => (
                      <span
                        key={column.key}
                        className={column.key === config.columns[0]!.key ? styles.lead : styles.cell}
                        data-align={column.align}
                        data-numeric={column.align === "end" ? "" : undefined}
                        data-wide-only={column.wideOnly ? "" : undefined}
                      >
                        {column.total?.(run.rows)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </>
            );
            if (!droppable) return <Fragment key={run.key}>{body}</Fragment>;
            return (
              <div
                key={run.key}
                className={styles.section}
                data-drop={dropKey === run.key ? "" : undefined}
                onDragOver={(event: DragEvent<HTMLDivElement>) => {
                  if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDropKey(run.key);
                }}
                onDragLeave={(event: DragEvent<HTMLDivElement>) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setDropKey((current) => (current === run.key ? null : current));
                  }
                }}
                onDrop={(event: DragEvent<HTMLDivElement>) => {
                  event.preventDefault();
                  setDropKey(null);
                  const id = event.dataTransfer.getData(DRAG_TYPE);
                  const row = shown.find((item) => item.id === id);
                  if (row) onMove?.(row, run.key);
                }}
              >
                {body}
              </div>
            );
          })
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
 * The open tab of ZRM or Capacity: the list of records, and once one is open
 * (or the New form), a resizable divider and the record (the route's page) on
 * the right. Lives in the app's layout and lists from data already loaded, so
 * switching tabs shows the new list at once, and moving between records keeps
 * the list, its search and its scroll.
 */
export function Workspace({ children }: { children: ReactNode }): ReactElement {
  const { data, kinds } = useZrmData();
  const { segments, pending } = useZrmRoute();
  const [segment, child = null] = segments;
  const shownChild = useSelectedLayoutSegments()[1] ?? null;
  /** On its way to another record or form: an empty pane shows a placeholder, an open record dims until it's replaced. */
  const loading = pending && child !== shownChild;
  const containerRef = useRef<HTMLDivElement>(null);
  const configs = useMemo(() => {
    const typeMap = new Map(data.types.map((type) => [type.id, type]));
    return {
      people: peopleConfig(typeMap),
      companies: companiesConfig(typeMap),
      sales: opportunitiesConfig(typeMap, "sales", data.stages),
      fundraising: opportunitiesConfig(typeMap, "fundraising", data.stages),
      sites: sitesConfig(data.statuses),
    };
  }, [data.types, data.statuses, data.stages]);

  const kind = kinds.find((k) => k === segment);
  /** The open list's filters, shared by its toolbar and the sidebar's types, and cleared on switching lists. */
  const [filters, setFilters] = useState<{ kind: RecordKind | undefined; values: Record<string, string> }>({ kind, values: {} });
  if (filters.kind !== kind) setFilters({ kind, values: {} });
  const filterValues = filters.values;
  const setFilter = (key: string, value: string) =>
    setFilters((current) => ({ ...current, values: { ...current.values, [key]: value } }));

  const { go, editRow } = useZrmNavigate();
  const moveOpportunity = (pipeline: OpportunityKind, row: OpportunityRow, stageId: string) => {
    if (row.stage_id === stageId) return;
    startTransition(async () => {
      editRow({ kind: pipeline, id: row.id, patch: { stage_id: stageId } });
      await setStageAction(pipeline, row.id, stageId);
    });
  };
  const sites = data.sites;
  const [menu, setMenu] = useState<{ kind: RecordKind; id: string; x: number; y: number } | null>(null);
  const openMenu = useCallback(
    (row: ListRow, x: number, y: number) => {
      if (kind) setMenu({ kind, id: row.id, x, y });
    },
    [kind],
  );
  const closeMenu = useCallback(
    (restoreFocus: boolean) => {
      setMenu(null);
      if (!restoreFocus || !menu) return;
      requestAnimationFrame(() => containerRef.current?.querySelector<HTMLElement>(`[data-id="${menu.id}"]`)?.focus());
    },
    [menu],
  );
  const shownMenu = menu?.kind === kind ? menu : null;
  const menuSite = shownMenu?.kind === "sites" ? sites.find((site) => site.id === shownMenu.id) : undefined;
  const menuPipeline = shownMenu && isOpportunityKind(shownMenu.kind) ? shownMenu.kind : undefined;
  const menuOpportunity = menuPipeline ? data[menuPipeline].find((o) => o.id === shownMenu!.id) : undefined;

  /** Applies the menu's change to the row while it saves, so it moves to its new section at once. */
  const saveRow = (rowKind: RecordKind, id: string, patch: Readonly<Record<string, unknown>>, save: () => Promise<unknown>) => {
    setMenu(null);
    startTransition(async () => {
      editRow({ kind: rowKind, id, patch });
      await save();
    });
  };

  if (!kind) return <>{children}</>;

  const common = {
    selectedId: child && child !== "new" ? child : null,
    filterValues,
    onFilterChange: setFilter,
  };
  const typeNav = (rows: readonly { type_ids: string[] }[]) => (
    <TypeNav rows={rows} types={data.types} value={filterValues.type ?? ""} onChange={(value) => setFilter("type", value)} />
  );
  let list: ReactElement;
  let types: ReactElement | null = null;
  switch (kind) {
    case "people":
      list = <RecordList key={kind} kind={kind} rows={data.people} config={configs.people} {...common} />;
      types = typeNav(data.people);
      break;
    case "companies":
      list = <RecordList key={kind} kind={kind} rows={data.companies} config={configs.companies} {...common} />;
      types = typeNav(data.companies);
      break;
    case "sales":
    case "fundraising":
      list = (
        <RecordList
          key={kind}
          kind={kind}
          rows={data[kind]}
          config={configs[kind]}
          onMove={(row, stageId) => moveOpportunity(kind, row, stageId)}
          onRowMenu={openMenu}
          menuRowId={shownMenu?.id ?? null}
          {...common}
        />
      );
      types = (
        <DealTypeNav kind={kind} value={filterValues.deal_type ?? ""} onChange={(value) => setFilter("deal_type", value)} />
      );
      break;
    case "sites":
      list = (
        <RecordList
          key={kind}
          kind={kind}
          rows={sites}
          config={configs.sites}
          onRowMenu={openMenu}
          menuRowId={shownMenu?.id ?? null}
          {...common}
        />
      );
      types = (
        <StatusNav rows={sites} statuses={data.statuses} value={filterValues.status ?? ""} onChange={(value) => setFilter("status", value)} />
      );
      break;
  }

  return (
    <div ref={containerRef} className={styles.workspace} data-view={child ? "detail" : "list"}>
      <section className={styles.listPane} aria-label={KIND_LABELS[kind].plural}>
        {list}
      </section>
      {types}
      {child ? (
        <>
          <Splitter
            containerRef={containerRef}
            storageKey={kind === "sites" ? "zode:capacity:list-share" : "zode:zrm:list-share"}
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
      {shownMenu && menuSite ? (
        <SiteMenu
          key={`${shownMenu.id}:${shownMenu.x}:${shownMenu.y}`}
          site={menuSite}
          x={shownMenu.x}
          y={shownMenu.y}
          statuses={data.statuses}
          onOpen={() => {
            setMenu(null);
            go(recordHref("sites", menuSite.id));
          }}
          onChange={(key, value) =>
            saveRow(
              "sites",
              menuSite.id,
              { ...clearedColumns("sites", key, value || null), [key]: key === "status_id" ? value : value || null },
              () => setSiteFieldAction(menuSite.id, key, value),
            )
          }
          onPin={() =>
            saveRow("sites", menuSite.id, { active: !menuSite.active }, () => setActiveAction("sites", menuSite.id, !menuSite.active))
          }
          onDelete={async () => (await deleteRecordAction("sites", menuSite.id)).error}
          onClose={closeMenu}
        />
      ) : null}
      {shownMenu && menuPipeline && menuOpportunity ? (
        <OpportunityMenu
          key={`${shownMenu.id}:${shownMenu.x}:${shownMenu.y}`}
          kind={menuPipeline}
          opportunity={menuOpportunity}
          x={shownMenu.x}
          y={shownMenu.y}
          stages={data.stages}
          onOpen={() => {
            setMenu(null);
            go(recordHref(menuPipeline, menuOpportunity.id));
          }}
          onChange={(key, value) => {
            if (menuOpportunity[key] === value) {
              setMenu(null);
              return;
            }
            saveRow(menuPipeline, menuOpportunity.id, { [key]: value }, () =>
              key === "stage_id"
                ? setStageAction(menuPipeline, menuOpportunity.id, value)
                : saveFieldAction(menuPipeline, menuOpportunity.id, key, value),
            );
          }}
          onPin={() =>
            saveRow(menuPipeline, menuOpportunity.id, { active: !menuOpportunity.active }, () =>
              setActiveAction(menuPipeline, menuOpportunity.id, !menuOpportunity.active),
            )
          }
          onDelete={async () => (await deleteRecordAction(menuPipeline, menuOpportunity.id)).error}
          onClose={closeMenu}
        />
      ) : null}
    </div>
  );
}
