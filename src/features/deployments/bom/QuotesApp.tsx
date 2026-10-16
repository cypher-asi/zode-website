"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import { Menu } from "@/components/ui/Menu";
import { OverlayScrollbar } from "@/components/ui/OverlayScrollbar";
import { Splitter } from "@/components/ui/Splitter";
import tree from "@/features/data-room/DataRoomApp.module.css";
import { Dialog, type DialogProps } from "@/features/data-room/Dialog";
import { fileKind, formatBytes, typeLabel } from "@/features/data-room/fileKinds";
import { FileGlyph, Icon } from "@/features/data-room/icons";
import ui from "@/features/data-room/ui.module.css";
import { UploadList } from "@/features/data-room/UploadList";
import { useBlobUploads } from "@/features/data-room/useUploads";
import { FilePreview } from "@/features/data-room/Viewer";
import viewer from "@/features/data-room/Viewer.module.css";
import { slotById } from "./slots";
import { formatCount, formatDay, formatUsd, plural } from "../format";
import type { Deployment } from "../types";
import {
  addQuoteAction,
  attachQuoteFileAction,
  deleteQuoteAction,
  removeQuoteFileAction,
  renameQuoteAction,
} from "./actions";
import { ItemLink, qty } from "./BomOverview";
import { phaseLabel } from "./phase";
import { QuoteEditor } from "./QuoteEditor";
import { formatCents, lineUsd, quoteFileUrl, quoteItemsUsd, quoteSections, type Bom, type Quote } from "./types";
import styles from "./bom.module.css";
import q from "./quotes.module.css";

const OVERVIEW = "overview";
const DRAG_FILES = "Files";

const uploadedOn = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

/** e.g. "$71.1M", for the narrow list. */
const compact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const quotedTotal = (quote: Quote, bom: Bom) => quote.quotedTotalUsd ?? quoteItemsUsd(quote.id, bom.items);

type View = "file" | "prices";

/**
 * A deployment's vendor quotes, laid out like a data room: the quotes listed
 * on the left, a resizable divider, and the open quote on the right with its
 * file previewed or its price list, which BOM lines are picked from. Files
 * dropped on the list, or added with +, become new quotes; dropped on a
 * quote, they replace its file. The ZODE team's only.
 */
export function QuotesApp({
  deployment,
  bom,
  roomFiles,
  initialQuoteId,
  today,
}: {
  deployment: Deployment;
  bom: Bom;
  /** The deployment's data room files, to link one as a quote's. */
  roomFiles: readonly { id: string; name: string }[];
  initialQuoteId: string | null;
  today: string;
}): ReactElement {
  const base = `/portal/deployments/${deployment.id}`;
  const [selected, setSelected] = useState<string>(() =>
    initialQuoteId && bom.quotes.some((quote) => quote.id === initialQuoteId) ? initialQuoteId : OVERVIEW,
  );
  const [opened, setOpened] = useState(Boolean(initialQuoteId));
  const [views, setViews] = useState<Record<string, View>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<Omit<DialogProps, "onClose"> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const newFilesRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<string | null>(null);
  const listId = useId();

  const quote = bom.quotes.find((row) => row.id === selected) ?? null;
  const used = useMemo(() => new Set(bom.lines.flatMap((line) => (line.quoteItemId ? [line.quoteItemId] : []))), [bom.lines]);

  const select = useCallback(
    (id: string) => {
      setSelected(id);
      setOpened(true);
      setEditing(null);
      window.history.replaceState(
        null,
        "",
        id === OVERVIEW ? `${base}?tab=quotes` : `${base}?tab=quotes&quote=${encodeURIComponent(id)}`,
      );
    },
    [base],
  );

  const register = useCallback(
    async (quoteId: string | null, pathname: string, name: string) => {
      const result = await attachQuoteFileAction(deployment.id, quoteId, pathname, name);
      if (result.id) {
        if (quoteId === null) select(result.id);
        setViews((current) => ({ ...current, [result.id!]: "file" }));
      }
      return result;
    },
    [deployment.id, select],
  );
  const uploads = useBlobUploads<string | null>({
    prefix: `deployments/${deployment.id}/quotes/`,
    handleUploadUrl: `/api/deployments/${deployment.id}/quotes/upload`,
    register,
  });

  useEffect(() => {
    if (!menuKey) return;
    const close = (event: PointerEvent) => {
      if (!(event.target as Element).closest("[data-menu]")) setMenuKey(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuKey]);

  const needle = query.trim().toLowerCase();
  const shown = bom.quotes.filter(
    (row) =>
      !needle ||
      [row.vendor, row.reference, row.file?.name].some((text) => text?.toLowerCase().includes(needle)) ||
      bom.items.some(
        (item) =>
          item.quoteId === row.id &&
          [item.partNumber, item.description, item.manufacturer].some((text) => text?.toLowerCase().includes(needle)),
      ),
  );
  const keys = [...(needle ? [] : [OVERVIEW]), ...shown.map((row) => row.id)];
  const currentFocus = focusKey && keys.includes(focusKey) ? focusKey : (keys[0] ?? null);

  const viewOf = (row: Quote): View => views[row.id] ?? (row.file ? "file" : "prices");
  const setView = (id: string, view: View) => setViews((current) => ({ ...current, [id]: view }));

  const pickFileFor = (quoteId: string) => {
    replaceTarget.current = quoteId;
    replaceRef.current?.click();
  };

  const run = async (action: () => Promise<{ error?: string }>) => {
    const result = await action();
    if (result.error) setNotice(result.error);
  };

  const rename = (row: Quote) =>
    setDialog({
      title: "Rename quote",
      input: { label: "Vendor", initial: row.vendor },
      confirmLabel: "Rename",
      onConfirm: async (vendor) => (await renameQuoteAction(deployment.id, row.id, vendor)).error,
    });

  const remove = (row: Quote) => {
    const lines = bom.lines.filter((line) => bom.items.some((item) => item.id === line.quoteItemId && item.quoteId === row.id));
    setDialog({
      title: `Delete “${row.vendor}”?`,
      description: `Its price list goes with it${row.file?.source === "upload" ? ", and its uploaded file" : ""}.${
        lines.length ? ` ${plural(lines.length, "BOM line")} picked from it keep their part numbers and prices.` : ""
      }`,
      confirmLabel: "Delete",
      danger: true,
      onConfirm: async () => {
        const result = await deleteQuoteAction(deployment.id, row.id);
        if (!result.error && selected === row.id) select(OVERVIEW);
        return result.error;
      },
    });
  };

  const removeFile = (row: Quote) =>
    setDialog({
      title: row.file?.source === "data-room" ? "Unlink the file?" : "Remove the file?",
      description:
        row.file?.source === "data-room"
          ? `“${row.file.name}” stays in the data room; the quote just stops pointing at it.`
          : `“${row.file?.name}” is deleted. The quote and its price list stay.`,
      confirmLabel: row.file?.source === "data-room" ? "Unlink" : "Remove",
      danger: row.file?.source !== "data-room",
      onConfirm: async () => (await removeQuoteFileAction(deployment.id, row.id)).error,
    });

  const actionsFor = (row: Quote) => [
    { id: "rename", label: "Rename", onSelect: () => rename(row) },
    { id: "file", label: row.file ? "Replace file" : "Upload file", onSelect: () => pickFileFor(row.id) },
    ...(row.file ? [{ id: "remove-file", label: row.file.source === "data-room" ? "Unlink file" : "Remove file", onSelect: () => removeFile(row) }] : []),
    { id: "delete", label: "Delete", danger: true, onSelect: () => remove(row) },
  ];

  const focusRow = (key: string | undefined) => {
    if (!key) return;
    setFocusKey(key);
    listRef.current?.querySelector<HTMLElement>(`[data-key="${key}"]`)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, key: string, i: number) => {
    if (event.target !== event.currentTarget) return;
    const row = bom.quotes.find((r) => r.id === key);
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusRow(keys[i + 1]);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusRow(keys[i - 1]);
        break;
      case "Home":
        event.preventDefault();
        focusRow(keys[0]);
        break;
      case "End":
        event.preventDefault();
        focusRow(keys.at(-1));
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        select(key);
        break;
      case "F2":
        if (row) {
          event.preventDefault();
          rename(row);
        }
        break;
      case "Delete":
        if (row) {
          event.preventDefault();
          remove(row);
        }
        break;
    }
  };

  /** Files dropped on the list become new quotes; on a quote, they replace its file. */
  const dropProps = (key: string, quoteId: string | null) => ({
    onDragOver: (event: DragEvent) => {
      if (!event.dataTransfer.types.includes(DRAG_FILES)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "copy";
      setDropKey(key);
    },
    onDragLeave: (event: DragEvent) => {
      if (!(event.currentTarget as Element).contains(event.relatedTarget as Node | null)) {
        setDropKey((current) => (current === key ? null : current));
      }
    },
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setDropKey(null);
      const files = [...event.dataTransfer.files];
      if (!files.length) return;
      if (quoteId) uploads.start(files.slice(0, 1), quoteId);
      else uploads.start(files, null);
    },
  });

  const totalQuoted = bom.quotes.reduce((sum, row) => sum + quotedTotal(row, bom), 0);

  return (
    <div ref={containerRef} className={q.app} data-view={opened ? "viewer" : "list"}>
      <section className={tree.side} aria-label="Quotes">
        <div className={tree.toolbar}>
          <div className={tree.search}>
            <label className={tree.searchField}>
              <Icon name="search" />
              <input
                type="search"
                placeholder="Search quotes and items"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search quotes and items"
              />
            </label>
            <Menu
              label="Add a quote"
              items={[
                { id: "upload", label: "Upload quotes", onSelect: () => newFilesRef.current?.click() },
                {
                  id: "blank",
                  label: "Type one in",
                  onSelect: () =>
                    void run(async () => {
                      const result = await addQuoteAction(deployment.id);
                      if (result.id) {
                        select(result.id);
                        setView(result.id, "prices");
                        setEditing(result.id);
                      }
                      return result;
                    }),
                },
              ]}
            >
              <Icon name="plus" />
            </Menu>
            <input
              ref={newFilesRef}
              type="file"
              multiple
              hidden
              onChange={(event) => {
                const files = [...(event.target.files ?? [])];
                if (files.length) uploads.start(files, null);
                event.target.value = "";
              }}
            />
            <input
              ref={replaceRef}
              type="file"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file && replaceTarget.current) uploads.start([file], replaceTarget.current);
                event.target.value = "";
              }}
            />
          </div>
        </div>

        <div className={tree.treeFrame}>
          <div
            ref={listRef}
            id={listId}
            className={tree.tree}
            role="listbox"
            aria-label="Quotes"
            data-drop={dropKey === "root" ? "" : undefined}
            {...dropProps("root", null)}
          >
            {needle ? null : (
              <div
                data-key={OVERVIEW}
                role="option"
                aria-selected={selected === OVERVIEW}
                aria-current={selected === OVERVIEW ? "true" : undefined}
                tabIndex={currentFocus === OVERVIEW ? 0 : -1}
                className={tree.row}
                data-group-end=""
                style={{ paddingLeft: 10 }}
                onClick={() => {
                  setFocusKey(OVERVIEW);
                  select(OVERVIEW);
                }}
                onFocus={() => setFocusKey(OVERVIEW)}
                onKeyDown={(event) => onKeyDown(event, OVERVIEW, 0)}
              >
                <Icon name="summary" className={tree.folderGlyph} />
                <span className={tree.rowName}>All quotes</span>
                <span className={tree.rowMeta}>{compact.format(totalQuoted)}</span>
              </div>
            )}
            {shown.map((row) => {
              const i = keys.indexOf(row.id);
              const current = row.id === selected;
              return (
                <div
                  key={row.id}
                  data-key={row.id}
                  role="option"
                  aria-selected={current}
                  aria-current={current ? "true" : undefined}
                  tabIndex={currentFocus === row.id ? 0 : -1}
                  className={tree.row}
                  data-drop={dropKey === row.id ? "" : undefined}
                  style={{ paddingLeft: 10 }}
                  title={row.file ? `${row.vendor} · ${row.file.name}` : row.vendor}
                  onClick={() => {
                    setFocusKey(row.id);
                    select(row.id);
                  }}
                  onFocus={() => setFocusKey(row.id)}
                  onKeyDown={(event) => onKeyDown(event, row.id, i)}
                  {...dropProps(row.id, row.id)}
                >
                  {row.file ? (
                    <FileGlyph kind={fileKind(row.file.name)} className={q.glyph} />
                  ) : (
                    <Icon name="file" className={`${q.glyph} ${q.noFile}`} />
                  )}
                  <span className={tree.rowName}>{row.vendor}</span>
                  <span className={tree.rowMeta}>{compact.format(quotedTotal(row, bom))}</span>
                  <span className={tree.rowMenu} data-menu>
                    <button
                      type="button"
                      className={tree.rowMenuButton}
                      tabIndex={-1}
                      aria-label={`Actions for ${row.vendor}`}
                      aria-haspopup="menu"
                      aria-expanded={menuKey === row.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        setMenuKey((key) => (key === row.id ? null : row.id));
                      }}
                    >
                      <Icon name="more" />
                    </button>
                    {menuKey === row.id ? (
                      <div className={tree.menu} role="menu" onClick={(event) => event.stopPropagation()}>
                        {actionsFor(row).map((action) => (
                          <button
                            key={action.id}
                            type="button"
                            role="menuitem"
                            className={tree.menuItem}
                            data-danger={"danger" in action ? "" : undefined}
                            onClick={() => {
                              setMenuKey(null);
                              action.onSelect();
                            }}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </span>
                </div>
              );
            })}
            {shown.length ? null : (
              <div className={tree.treeEmpty}>
                <p>
                  {needle
                    ? `No quotes or items match “${query.trim()}”.`
                    : "No quotes yet. Drop vendor quotes here or add them with +."}
                </p>
              </div>
            )}
          </div>
          <OverlayScrollbar targetId={listId} showOnHover />
        </div>

        <UploadList uploads={uploads} />

        {notice ? (
          <p className={tree.notice} role="alert">
            {notice}
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
              <Icon name="close" />
            </button>
          </p>
        ) : null}

        <div className={tree.footer}>
          <span className={tree.count}>
            {plural(bom.quotes.length, "quote")} · {formatUsd(totalQuoted)} quoted
          </span>
        </div>
      </section>

      <Splitter
        containerRef={containerRef}
        storageKey="zode:quotes:list-share"
        label="Resize quote list"
        cssVar="--tree-width"
        defaultFraction={0.28}
      />

      <section className={tree.main} aria-label={quote ? quote.vendor : "All quotes"}>
        {quote ? (
          <QuotePanel
            key={quote.id}
            deployment={deployment}
            quote={quote}
            bom={bom}
            used={used}
            roomFiles={roomFiles}
            today={today}
            view={viewOf(quote)}
            onView={(view) => setView(quote.id, view)}
            editing={editing === quote.id}
            onEdit={(on) => setEditing(on ? quote.id : null)}
            onBack={() => setOpened(false)}
            onPickFile={() => pickFileFor(quote.id)}
            onRemoveFile={() => removeFile(quote)}
            onDropFile={(file) => uploads.start([file], quote.id)}
          />
        ) : (
          <QuotesOverview bom={bom} today={today} onOpen={select} onBack={() => setOpened(false)} />
        )}
      </section>

      {dialog ? <Dialog {...dialog} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}

function expiredOn(quote: Quote, today: string): boolean {
  return quote.validUntil !== null && quote.validUntil < today;
}

const metaOf = (quote: Quote, total: number) =>
  [
    quote.reference ? `Quote ${quote.reference}` : null,
    quote.quotedOn ? formatDay(quote.quotedOn) : null,
    quote.validUntil ? `valid until ${formatDay(quote.validUntil)}` : null,
    formatCents(total),
  ]
    .filter(Boolean)
    .join(" · ");

function QuotePanel({
  deployment,
  quote,
  bom,
  used,
  roomFiles,
  today,
  view,
  onView,
  editing,
  onEdit,
  onBack,
  onPickFile,
  onRemoveFile,
  onDropFile,
}: {
  deployment: Deployment;
  quote: Quote;
  bom: Bom;
  used: ReadonlySet<string>;
  roomFiles: readonly { id: string; name: string }[];
  today: string;
  view: View;
  onView: (view: View) => void;
  editing: boolean;
  onEdit: (on: boolean) => void;
  onBack: () => void;
  onPickFile: () => void;
  onRemoveFile: () => void;
  onDropFile: (file: File) => void;
}): ReactElement {
  const items = bom.items.filter((item) => item.quoteId === quote.id);
  const [dropping, setDropping] = useState(false);
  const back = (
    <button type="button" className={`${ui.iconButton} ${viewer.back}`} onClick={onBack} aria-label="Back to quotes">
      <Icon name="back" />
    </button>
  );

  return (
    <div className={viewer.viewer}>
      <header className={viewer.header}>
        {back}
        {quote.file ? (
          <FileGlyph kind={fileKind(quote.file.name)} className={viewer.glyph} />
        ) : (
          <Icon name="file" className={`${viewer.glyph} ${q.noFile}`} />
        )}
        <div className={viewer.titles}>
          <h2 className={viewer.name} title={quote.vendor}>
            {quote.vendor}
          </h2>
          <p className={viewer.meta}>{metaOf(quote, quotedTotal(quote, bom))}</p>
        </div>
        {expiredOn(quote, today) ? (
          <span className={styles.badge} data-tone="danger">
            Expired
          </span>
        ) : null}
        <div className={q.views} role="tablist" aria-label="Show">
          <button type="button" role="tab" aria-selected={view === "file"} onClick={() => onView("file")}>
            File
          </button>
          <button type="button" role="tab" aria-selected={view === "prices"} onClick={() => onView("prices")}>
            Price list <span className={q.viewCount}>{formatCount(items.length)}</span>
          </button>
        </div>
      </header>

      {view === "file" ? (
        quote.file ? (
          <FilePreview
            url={quoteFileUrl(deployment.id, quote.id)}
            file={quote.file}
            meta={`${typeLabel(quote.file.name)} · ${formatBytes(quote.file.sizeBytes)} · ${
              quote.file.source === "data-room"
                ? "From the data room"
                : `Uploaded ${uploadedOn.format(new Date(quote.file.createdAt))}`
            }`}
            trailing={
              <Menu
                label="File actions"
                items={[
                  { id: "replace", label: "Replace file", onSelect: onPickFile },
                  {
                    id: "remove",
                    label: quote.file.source === "data-room" ? "Unlink file" : "Remove file",
                    onSelect: onRemoveFile,
                  },
                ]}
              >
                <Icon name="more" />
              </Menu>
            }
          />
        ) : (
          <div
            className={`${viewer.empty} ${q.dropZone}`}
            data-drop={dropping ? "" : undefined}
            onDragOver={(event) => {
              if (!event.dataTransfer.types.includes(DRAG_FILES)) return;
              event.preventDefault();
              setDropping(true);
            }}
            onDragLeave={() => setDropping(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDropping(false);
              const file = event.dataTransfer.files[0];
              if (file) onDropFile(file);
            }}
          >
            <Icon name="upload" />
            <p>No file for this quote yet. Drop the vendor&apos;s PDF or spreadsheet here.</p>
            <button type="button" className={ui.primary} onClick={onPickFile}>
              <Icon name="upload" />
              Upload file
            </button>
            {deployment.dataRoomId ? (
              <p className={q.hint}>Or link one from the data room in the price list&apos;s details.</p>
            ) : null}
          </div>
        )
      ) : (
        <div className={q.scroll}>
          {editing ? (
            <QuoteEditor
              deploymentId={deployment.id}
              quote={quote}
              items={items}
              used={used}
              roomFiles={roomFiles}
              hasRoom={Boolean(deployment.dataRoomId)}
              onDone={() => onEdit(false)}
            />
          ) : (
            <PriceList deployment={deployment} quote={quote} bom={bom} onEdit={() => onEdit(true)} />
          )}
        </div>
      )}
    </div>
  );
}

/** One quote as the vendor priced it, under its own headings, with where the BOM uses each item. */
function PriceList({
  deployment,
  quote,
  bom,
  onEdit,
}: {
  deployment: Deployment;
  quote: Quote;
  bom: Bom;
  onEdit: () => void;
}): ReactElement {
  const sections = quoteSections(quote.id, bom.items);
  const phases = new Map(deployment.phases.map((phase, i) => [phase.id, phaseLabel(phase, i)]));
  const ids = new Set(sections.flatMap((section) => section.items.map((item) => item.id)));
  const lines = bom.lines.filter((line) => line.quoteItemId && ids.has(line.quoteItemId));
  const itemsUsd = quoteItemsUsd(quote.id, bom.items);

  return (
    <div className={q.prices}>
      <div className={styles.head}>
        <dl className={q.facts}>
          <div>
            <dt>Items total</dt>
            <dd>{formatCents(itemsUsd)}</dd>
          </div>
          {quote.quotedTotalUsd !== null ? (
            <div>
              <dt>Stated total</dt>
              <dd>{formatCents(quote.quotedTotalUsd)}</dd>
            </div>
          ) : null}
          <div>
            <dt>Used in the BOM</dt>
            <dd>
              {plural(new Set(lines.map((line) => line.quoteItemId)).size, "item")} ·{" "}
              {formatUsd(lines.reduce((sum, line) => sum + lineUsd(line), 0))}
            </dd>
          </div>
        </dl>
        <button type="button" className={ui.button} onClick={onEdit}>
          Edit
        </button>
      </div>
      {quote.notes ? <p className={q.notes}>{quote.notes}</p> : null}

      {sections.length ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col" data-text="">
                  Item
                </th>
                <th scope="col" data-text="">
                  Manufacturer
                </th>
                <th scope="col">Qty</th>
                <th scope="col">Unit</th>
                <th scope="col">Extended</th>
                <th scope="col" data-text="">
                  Used in
                </th>
              </tr>
            </thead>
            {sections.map((section) => (
              <tbody key={section.title}>
                <tr data-group="">
                  <th colSpan={6}>{section.title || "Items"}</th>
                </tr>
                {section.items.map((item) => {
                  const uses = bom.lines.filter((line) => line.quoteItemId === item.id);
                  return (
                    <tr key={item.id} data-included={item.unitUsd === null ? "" : undefined}>
                      <td data-text="">
                        {item.partNumber ? <span className={styles.part}>{item.partNumber}</span> : null}
                        <span className={item.partNumber ? styles.sub : undefined}>{item.description}</span>
                        {item.leadTime ? <span className={styles.sub}>Lead time {item.leadTime}</span> : null}
                        {item.notes ? <span className={styles.sub}>{item.notes}</span> : null}
                        <ItemLink url={item.url} />
                      </td>
                      <td data-text="">{item.manufacturer ?? "—"}</td>
                      <td className={styles.nowrap}>{item.quantity === null ? "—" : qty(item.quantity)}</td>
                      <td className={styles.nowrap}>{item.unitUsd === null ? "Included" : formatCents(item.unitUsd)}</td>
                      <td className={styles.nowrap}>{item.unitUsd === null ? "" : formatCents(lineUsd(item))}</td>
                      <td data-text="">
                        {uses.length ? (
                          <ul className={styles.lines}>
                            {uses.map((line) => (
                              <li key={line.id}>
                                {phases.get(line.phaseId)} · {line.slotId ? slotById(line.slotId)?.label : "Other"} ×{" "}
                                {qty(line.quantity)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className={styles.sub}>Not used</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                <tr data-total="">
                  <th colSpan={4} data-text="">
                    Subtotal
                  </th>
                  <td className={styles.nowrap}>
                    {formatCents(section.items.reduce((sum, item) => sum + lineUsd(item), 0))}
                  </td>
                  <td />
                </tr>
              </tbody>
            ))}
            <tbody>
              <tr data-total="">
                <th colSpan={4} data-text="">
                  Quote total
                </th>
                <td className={styles.nowrap}>{formatCents(itemsUsd)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <p className={q.hint}>
          No price list yet. Edit the quote to add the items it prices; the BOM editor picks lines from them.
        </p>
      )}
    </div>
  );
}

/** Every quote side by side: what each states, how much of it the BOM uses and what that costs. */
function QuotesOverview({
  bom,
  today,
  onOpen,
  onBack,
}: {
  bom: Bom;
  today: string;
  onOpen: (quoteId: string) => void;
  onBack: () => void;
}): ReactElement {
  const rows = bom.quotes.map((quote) => {
    const ids = new Set(bom.items.filter((item) => item.quoteId === quote.id).map((item) => item.id));
    const lines = bom.lines.filter((line) => line.quoteItemId && ids.has(line.quoteItemId));
    return {
      quote,
      items: ids.size,
      usedItems: new Set(lines.map((line) => line.quoteItemId)).size,
      bomUsd: lines.reduce((sum, line) => sum + lineUsd(line), 0),
      total: quotedTotal(quote, bom),
    };
  });
  const quoted = rows.reduce((sum, row) => sum + row.total, 0);
  const inBom = rows.reduce((sum, row) => sum + row.bomUsd, 0);

  return (
    <div className={viewer.viewer}>
      <header className={viewer.header}>
        <button type="button" className={`${ui.iconButton} ${viewer.back}`} onClick={onBack} aria-label="Back to quotes">
          <Icon name="back" />
        </button>
        <Icon name="summary" className={viewer.glyph} />
        <div className={viewer.titles}>
          <h2 className={viewer.name}>All quotes</h2>
          <p className={viewer.meta}>
            {plural(rows.length, "quote")} · {formatUsd(quoted)} quoted · {formatUsd(inBom)} picked into the BOM
          </p>
        </div>
      </header>
      <div className={q.scroll}>
        <div className={q.prices}>
          <p className={q.hint}>
            Quotes are price lists. The BOM editor picks their items into each phase&apos;s slots at the quantities the
            phase needs, so a quote needn&apos;t match the BOM.
          </p>
          {rows.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col" data-text="">
                      Vendor
                    </th>
                    <th scope="col" data-text="">
                      Quote
                    </th>
                    <th scope="col">Items</th>
                    <th scope="col">Quoted</th>
                    <th scope="col">Used in the BOM</th>
                    <th scope="col">BOM cost</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.quote.id}>
                      <th scope="row" data-text="">
                        <button type="button" className={q.openLink} onClick={() => onOpen(row.quote.id)}>
                          {row.quote.vendor}
                        </button>
                        {row.quote.file ? <span className={styles.sub}>{row.quote.file.name}</span> : null}
                      </th>
                      <td data-text="">
                        {row.quote.reference ?? "—"}
                        <span className={styles.sub}>
                          {[
                            row.quote.quotedOn ? formatDay(row.quote.quotedOn) : null,
                            row.quote.validUntil ? `valid until ${formatDay(row.quote.validUntil)}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                          {expiredOn(row.quote, today) ? (
                            <>
                              {" "}
                              <span className={styles.badge} data-tone="danger">
                                Expired
                              </span>
                            </>
                          ) : null}
                        </span>
                      </td>
                      <td>{formatCount(row.items)}</td>
                      <td className={styles.nowrap}>{formatCents(row.total)}</td>
                      <td>{formatCount(row.usedItems)}</td>
                      <td className={styles.nowrap}>{formatUsd(row.bomUsd)}</td>
                    </tr>
                  ))}
                </tbody>
                <tbody>
                  <tr data-total="">
                    <th colSpan={3} data-text="">
                      Total
                    </th>
                    <td className={styles.nowrap}>{formatCents(quoted)}</td>
                    <td />
                    <td className={styles.nowrap}>{formatUsd(inBom)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className={q.hint}>No quotes yet. Drop vendor quotes on the list, or add them with +.</p>
          )}
        </div>
      </div>
    </div>
  );
}
