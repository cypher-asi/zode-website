"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import type { ItemRef } from "./actions";
import { fileKind, formatBytes } from "./fileKinds";
import { FileGlyph, Icon } from "./icons";
import { ancestorsOf, fileKey, folderKey, folderPath, type TreeAction, type TreeIndex } from "./tree";
import type { RoomFile, RoomTree } from "./types";
import styles from "./RoomBrowser.module.css";

const THUMB_MAX_BYTES = 12 * 1024 * 1024;

const DRAG_TYPE = "application/x-zode-data-room-items";

export const VIEWS = [
  { id: "icons-xl", label: "Extra large icons" },
  { id: "icons-lg", label: "Large icons" },
  { id: "icons-md", label: "Medium icons" },
  { id: "icons-sm", label: "Small icons", sep: true },
  { id: "list", label: "List" },
  { id: "details", label: "Details", sep: true },
  { id: "tiles", label: "Tiles" },
] as const;

export type ViewMode = (typeof VIEWS)[number]["id"];
type SortKey = "name" | "modified" | "size";

interface FolderEntry {
  kind: "folder";
  id: string;
  name: string;
  path: string;
}
interface FileEntry {
  kind: "file";
  id: string;
  name: string;
  path: string;
  file: RoomFile;
}
interface SummaryEntry {
  kind: "summary";
  id: "summary";
  name: "Summary";
  path: "";
}
type Entry = FolderEntry | FileEntry | SummaryEntry;

const isViewMode = (value: string | null): value is ViewMode => VIEWS.some((view) => view.id === value);

/** The remembered view, read from localStorage so it survives reloads and follows other tabs. */
const viewListeners = new Set<() => void>();
function subscribeView(listener: () => void): () => void {
  viewListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    viewListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** The view stored under `key`, `fallback` until one is chosen, and a setter that remembers the choice. */
export function useStoredView(key: string, fallback: ViewMode): [ViewMode, (mode: ViewMode) => void] {
  const view = useSyncExternalStore(
    subscribeView,
    () => {
      const value = window.localStorage.getItem(key);
      return isViewMode(value) ? value : fallback;
    },
    () => fallback,
  );
  const save = (mode: ViewMode) => {
    window.localStorage.setItem(key, mode);
    for (const listener of viewListeners) listener();
  };
  return [view, save];
}

const modifiedOn = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

const selectKey = (entry: Entry): string | null =>
  entry.kind === "file" ? fileKey(entry.id) : entry.kind === "folder" ? folderKey(entry.id) : null;

/** Checked keys as the items they name. */
export const refsOf = (keys: Iterable<string>): ItemRef[] =>
  [...keys].map((key): ItemRef => ({ kind: key.startsWith("d:") ? "folder" : "file", id: key.slice(2) }));

const parentPath = (index: TreeIndex, folderId: string | null): string =>
  folderId && index.folders.has(folderId) ? folderPath(index, folderId) : "";

/** Icon views large enough that a photo is worth fetching; list and details stay glyphs. */
const showsThumb = (view: ViewMode): boolean => view === "icons-md" || view === "icons-lg" || view === "icons-xl" || view === "tiles";

/** Bytes a zip of `checked` would hold, counting each file once. */
export function checkedBytes(tree: RoomTree, index: TreeIndex, checked: Set<string>): number {
  return tree.files
    .filter(
      (file) =>
        checked.has(fileKey(file.id)) ||
        (file.folderId !== null && [...ancestorsOf(index, file.folderId), file.folderId].some((id) => checked.has(folderKey(id)))),
    )
    .reduce((sum, file) => sum + file.sizeBytes, 0);
}

export interface ToolMenuItem {
  id: string;
  label: string;
  onSelect: () => void;
  /** Set, the item is one of a radio group and shows a tick while true. */
  checked?: boolean;
  /** A rule above the item. */
  sep?: boolean;
}

/** A toolbar button that drops a menu of `items`; `children` is the button's content. */
export function ToolMenu({ label, items, children }: { label: string; items: readonly ToolMenuItem[]; children: ReactNode }): ReactElement {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={styles.menuWrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.tool}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        {children}
      </button>
      {open ? (
        <ul id={menuId} className={styles.menu} role="menu" aria-label={label}>
          {items.map((item) => (
            <li key={item.id} role="none" data-sep={item.sep ? "" : undefined}>
              <button
                type="button"
                role={item.checked === undefined ? "menuitem" : "menuitemradio"}
                aria-checked={item.checked}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.checked === undefined ? null : <Icon name="check" />}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** The View button: Explorer's icon sizes, list, details and tiles. */
export function ViewMenu({ view, onChange }: { view: ViewMode; onChange: (mode: ViewMode) => void }): ReactElement {
  return (
    <ToolMenu
      label="View"
      items={VIEWS.map((item) => ({
        id: item.id,
        label: item.label,
        checked: view === item.id,
        sep: "sep" in item,
        onSelect: () => onChange(item.id),
      }))}
    >
      <Icon name="grid" />
      <Icon name="arrowDown" />
    </ToolMenu>
  );
}

function EntryGlyph({ entry, thumbUrl }: { entry: Entry; thumbUrl: ((fileId: string) => string) | null }): ReactElement {
  if (entry.kind === "folder") return <Icon name="folder" className={styles.folder} />;
  if (entry.kind === "summary") return <Icon name="summary" className={styles.summaryGlyph} />;
  const kind = fileKind(entry.file.name);
  if (thumbUrl && kind === "image" && entry.file.sizeBytes <= THUMB_MAX_BYTES) {
    return <Thumb src={thumbUrl(entry.file.id)} />;
  }
  return <FileGlyph kind={kind} className={styles.fileGlyph} />;
}

function Thumb({ src }: { src: string }): ReactElement {
  const [failed, setFailed] = useState(false);
  if (failed) return <FileGlyph kind="image" className={styles.fileGlyph} />;
  // Served by the access-checked file route, which the image optimizer can't fetch.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={styles.thumb} src={src} alt="" decoding="async" loading="lazy" onError={() => setFailed(true)} />;
}

/** What an admin can do from the browser: act on an item, drop files in, and drag items into folders. */
export interface BrowserAdmin {
  onAction: (action: TreeAction, item: ItemRef) => void;
  onDropFiles: (files: File[], folderId: string | null) => void;
  onMove: (items: ItemRef[], folderId: string | null) => void;
}

export interface RoomBrowserProps {
  tree: RoomTree;
  index: TreeIndex;
  /** The top level's name, in the trail and as the title there. */
  rootName: string;
  /** Over the title at the top level, where there's no trail. */
  rootCrumb: ReactNode;
  titleAs?: "h1" | "h2";
  folderId: string | null;
  query: string;
  view: ViewMode;
  /** Pins a Summary entry first at the top level. */
  hasSummary: boolean;
  checked: Set<string>;
  onCheckedChange: (checked: Set<string>) => void;
  /** A small copy of an image, for the icon views. */
  thumbUrl: (fileId: string) => string;
  onOpenFolder: (folderId: string | null) => void;
  onOpenFile: (file: RoomFile) => void;
  onOpenSummary: () => void;
  admin?: BrowserAdmin;
}

/**
 * A room's folder as Explorer or Dropbox shows one: a trail back up, then its
 * folders and files in the chosen view, or every match while searching.
 * Folders, files and the summary open through the callbacks; checked items
 * are the caller's, for downloads and bulk actions.
 */
export function RoomBrowser({
  tree,
  index,
  rootName,
  rootCrumb,
  titleAs: Title = "h1",
  folderId,
  query,
  view,
  hasSummary,
  checked,
  onCheckedChange,
  thumbUrl,
  onOpenFolder,
  onOpenFile,
  onOpenSummary,
  admin,
}: RoomBrowserProps): ReactElement {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const allRef = useRef<HTMLInputElement>(null);

  const needle = query.trim().toLowerCase();
  const searching = needle.length > 0;

  const entries = (() => {
    let rows: Entry[];
    if (searching) {
      rows = [
        ...[...index.folders.values()]
          .filter((folder) => folder.name.toLowerCase().includes(needle))
          .map(
            (folder): FolderEntry => ({
              kind: "folder",
              id: folder.id,
              name: folder.name,
              path: parentPath(index, folder.parentId),
            }),
          ),
        ...tree.files
          .filter((file) => file.name.toLowerCase().includes(needle))
          .map(
            (file): FileEntry => ({
              kind: "file",
              id: file.id,
              name: file.name,
              path: parentPath(index, file.folderId),
              file,
            }),
          ),
      ];
    } else {
      rows = [
        ...(hasSummary && !folderId
          ? [{ kind: "summary" as const, id: "summary" as const, name: "Summary" as const, path: "" as const }]
          : []),
        ...(index.childFolders.get(folderId) ?? []).map(
          (folder): FolderEntry => ({ kind: "folder", id: folder.id, name: folder.name, path: "" }),
        ),
        ...(index.childFiles.get(folderId) ?? []).map(
          (file): FileEntry => ({ kind: "file", id: file.id, name: file.name, path: "", file }),
        ),
      ];
    }
    const dir = sort.dir === "asc" ? 1 : -1;
    return rows.sort((a, b) => {
      if (a.kind === "summary") return -1;
      if (b.kind === "summary") return 1;
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
      if (sort.key === "size") {
        const size = (entry: Entry) => (entry.kind === "file" ? entry.file.sizeBytes : -1);
        return (size(a) - size(b)) * dir;
      }
      if (sort.key === "modified") {
        const when = (entry: Entry) => (entry.kind === "file" ? entry.file.createdAt : "");
        return when(a).localeCompare(when(b)) * dir;
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }) * dir;
    });
  })();

  const selectable = entries.flatMap((entry) => {
    const key = selectKey(entry);
    return key ? [key] : [];
  });
  const allSelected = selectable.length > 0 && selectable.every((key) => checked.has(key));
  const someSelected = selectable.some((key) => checked.has(key));

  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = someSelected && !allSelected;
  }, [allSelected, someSelected]);

  useEffect(() => {
    if (!menuKey) return;
    const onPointer = (event: PointerEvent) => {
      if (!(event.target as Element).closest("[data-item-menu]")) setMenuKey(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuKey(null);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuKey]);

  const toggleSort = (key: SortKey) => {
    setSort((current) => (current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  };

  const toggleChecked = (key: string) => {
    const next = new Set(checked);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onCheckedChange(next);
  };

  const openEntry = (entry: Entry) => {
    if (entry.kind === "summary") onOpenSummary();
    else if (entry.kind === "folder") onOpenFolder(entry.id);
    else onOpenFile(entry.file);
  };

  const isChecked = (entry: Entry): boolean => {
    const key = selectKey(entry);
    return key ? checked.has(key) : false;
  };

  const checkbox = (entry: Entry) => {
    const key = selectKey(entry);
    if (!key) return null;
    return (
      <input
        type="checkbox"
        className={styles.check}
        checked={checked.has(key)}
        aria-label={`Select ${entry.name}`}
        onClick={(event) => event.stopPropagation()}
        onChange={() => toggleChecked(key)}
      />
    );
  };

  /** Where `item` sits now, so dropping it there again does nothing. */
  const parentOf = (item: ItemRef): string | null =>
    item.kind === "folder"
      ? (index.folders.get(item.id)?.parentId ?? null)
      : (tree.files.find((file) => file.id === item.id)?.folderId ?? null);

  const dropProps = (key: string, target: string | null) =>
    admin
      ? {
          "data-drop": dropKey === key ? "" : undefined,
          onDragOver: (event: DragEvent) => {
            const types = event.dataTransfer.types;
            if (!types.includes("Files") && !types.includes(DRAG_TYPE)) return;
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = types.includes("Files") ? "copy" : "move";
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
            if (event.dataTransfer.files.length) {
              admin.onDropFiles([...event.dataTransfer.files], target);
              return;
            }
            const raw = event.dataTransfer.getData(DRAG_TYPE);
            if (!raw) return;
            const into = target ? [...ancestorsOf(index, target), target] : [];
            const items = (JSON.parse(raw) as ItemRef[]).filter(
              (item) => parentOf(item) !== target && !(item.kind === "folder" && into.includes(item.id)),
            );
            if (items.length) admin.onMove(items, target);
          },
        }
      : {};

  /** Drags the checked items when this one is among them, otherwise just this one. */
  const dragProps = (entry: Entry) => {
    const key = selectKey(entry);
    if (!admin || !key || entry.kind === "summary") return {};
    return {
      draggable: true,
      onDragStart: (event: DragEvent) => {
        const items: ItemRef[] = checked.has(key) ? refsOf(checked) : [{ kind: entry.kind, id: entry.id }];
        event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(items));
        event.dataTransfer.effectAllowed = "move";
      },
    };
  };

  /** Drops onto a folder land in it. */
  const entryProps = (entry: Entry) => ({
    ...dragProps(entry),
    ...(entry.kind === "folder" ? dropProps(folderKey(entry.id), entry.id) : {}),
  });

  const itemMenu = (entry: Entry) => {
    const key = selectKey(entry);
    if (!admin || !key || entry.kind === "summary") return null;
    const open = menuKey === key;
    return (
      <span className={styles.itemMenu} data-item-menu>
        <button
          type="button"
          className={styles.itemMenuButton}
          aria-label={`Actions for ${entry.name}`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={(event) => {
            event.stopPropagation();
            setMenuKey(open ? null : key);
          }}
        >
          <Icon name="more" />
        </button>
        {open ? (
          <ul className={styles.menu} role="menu" aria-label={`Actions for ${entry.name}`}>
            {(["rename", "move", "delete"] as const).map((action) => (
              <li key={action} role="none">
                <button
                  type="button"
                  role="menuitem"
                  data-danger={action === "delete" ? "" : undefined}
                  onClick={() => {
                    setMenuKey(null);
                    admin.onAction(action, { kind: entry.kind, id: entry.id });
                  }}
                >
                  {action === "rename" ? "Rename" : action === "move" ? "Move to…" : "Delete"}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </span>
    );
  };

  const trail = folderId ? [...ancestorsOf(index, folderId), folderId] : [];
  const title = searching ? "Search" : folderId ? (index.folders.get(folderId)?.name ?? rootName) : rootName;
  const glyphThumb = showsThumb(view) ? thumbUrl : null;
  const empty = searching
    ? "Nothing matches that search."
    : admin
      ? "This folder is empty. Drop files here, or use Add."
      : "This folder is empty.";

  return (
    <div className={styles.browser}>
      <div className={styles.heading}>
        {searching ? (
          <p className={styles.crumb}>
            {entries.length.toLocaleString()} {entries.length === 1 ? "match" : "matches"} for “{query.trim()}”
          </p>
        ) : trail.length ? (
          <nav className={styles.crumb} aria-label="Folder">
            <button type="button" onClick={() => onOpenFolder(null)} {...dropProps("crumb:", null)}>
              {rootName}
            </button>
            {trail.map((id, i) => (
              <span key={id}>
                <span aria-hidden="true">/</span>
                {i === trail.length - 1 ? (
                  <span aria-current="location">{index.folders.get(id)?.name}</span>
                ) : (
                  <button type="button" onClick={() => onOpenFolder(id)} {...dropProps(`crumb:${id}`, id)}>
                    {index.folders.get(id)?.name}
                  </button>
                )}
              </span>
            ))}
          </nav>
        ) : (
          <p className={styles.crumb}>{rootCrumb}</p>
        )}
        <Title className={styles.title}>{title}</Title>
      </div>
      <div className={styles.scroller} data-view={view} {...(searching ? {} : dropProps("here", folderId))}>
        {entries.length === 0 ? (
          <p className={styles.empty}>{empty}</p>
        ) : view === "details" ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.checkCol}>
                  <input
                    ref={allRef}
                    type="checkbox"
                    className={styles.check}
                    checked={allSelected}
                    disabled={!selectable.length}
                    aria-label={allSelected ? "Clear selection" : "Select all"}
                    onChange={() => onCheckedChange(allSelected ? new Set() : new Set(selectable))}
                  />
                </th>
                {(["name", "modified", "size"] as const).map((key) => (
                  <th key={key} className={key === "name" ? undefined : styles[key]}>
                    <button
                      type="button"
                      className={styles.sort}
                      data-active={sort.key === key || undefined}
                      data-dir={sort.dir}
                      onClick={() => toggleSort(key)}
                    >
                      {key === "name" ? "Name" : key === "modified" ? "Modified" : "Size"}
                      <Icon name="arrowDown" />
                    </button>
                  </th>
                ))}
                {admin ? <th className={styles.actionCol} aria-label="Actions" /> : null}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.kind + entry.id} data-selected={isChecked(entry) ? "" : undefined} {...entryProps(entry)}>
                  <td className={styles.checkCol}>{checkbox(entry)}</td>
                  <td>
                    <button type="button" className={styles.nameButton} onClick={() => openEntry(entry)}>
                      <EntryGlyph entry={entry} thumbUrl={null} />
                      <span className={styles.nameText}>
                        <span>{entry.name}</span>
                        {entry.path ? <span className={styles.path}>{entry.path}</span> : null}
                      </span>
                    </button>
                  </td>
                  <td className={styles.modified}>
                    {entry.kind === "file" ? modifiedOn.format(new Date(entry.file.createdAt)) : "—"}
                  </td>
                  <td className={styles.size}>{entry.kind === "file" ? formatBytes(entry.file.sizeBytes) : "—"}</td>
                  {admin ? <td className={styles.actionCol}>{itemMenu(entry)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        ) : view === "list" ? (
          <ul className={styles.list}>
            {entries.map((entry) => (
              <li key={entry.kind + entry.id} data-selected={isChecked(entry) ? "" : undefined} {...entryProps(entry)}>
                {checkbox(entry)}
                <button type="button" className={styles.listButton} onClick={() => openEntry(entry)}>
                  <EntryGlyph entry={entry} thumbUrl={null} />
                  <span>{entry.name}</span>
                </button>
                {itemMenu(entry)}
              </li>
            ))}
          </ul>
        ) : view === "tiles" ? (
          <ul className={styles.tiles}>
            {entries.map((entry) => (
              <li key={entry.kind + entry.id} data-selected={isChecked(entry) ? "" : undefined} {...entryProps(entry)}>
                {checkbox(entry)}
                <button type="button" onClick={() => openEntry(entry)}>
                  <EntryGlyph entry={entry} thumbUrl={glyphThumb} />
                  <span>
                    <span className={styles.tileName}>{entry.name}</span>
                    <span className={styles.path}>
                      {entry.path ||
                        (entry.kind === "file"
                          ? `${modifiedOn.format(new Date(entry.file.createdAt))} · ${formatBytes(entry.file.sizeBytes)}`
                          : entry.kind === "folder"
                            ? "Folder"
                            : "Overview")}
                    </span>
                  </span>
                </button>
                {itemMenu(entry)}
              </li>
            ))}
          </ul>
        ) : (
          <ul className={styles.icons}>
            {entries.map((entry) => (
              <li key={entry.kind + entry.id} data-selected={isChecked(entry) ? "" : undefined} {...entryProps(entry)}>
                {checkbox(entry)}
                <button type="button" onClick={() => openEntry(entry)}>
                  <EntryGlyph entry={entry} thumbUrl={glyphThumb} />
                  <span className={styles.iconName}>{entry.name}</span>
                </button>
                {itemMenu(entry)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
