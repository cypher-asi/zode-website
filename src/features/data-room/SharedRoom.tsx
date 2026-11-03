"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactElement } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { copyText } from "@/features/profile/ProfileClient";
import { fileKind, formatBytes } from "./fileKinds";
import { ancestorsOf, folderPath, indexTree, type TreeIndex } from "./FileTree";
import { FileGlyph, Icon } from "./icons";
import { MAX_ARCHIVE_BYTES, sharedFilePath, sharedRoomPath, type RoomFile, type RoomTree } from "./types";
import { FilePreview, SummaryPanel, type RoomSummary } from "./Viewer";
import viewer from "./Viewer.module.css";
import { downloadRoomZip, postRoomArchive, type ZipProgress, type ZipSelection } from "./zipDownload";
import styles from "./SharedRoom.module.css";
import ui from "./ui.module.css";

const VIEW_KEY = "zode:shared-room:view";
const THUMB_MAX_BYTES = 12 * 1024 * 1024;

const VIEWS = [
  { id: "icons-xl", label: "Extra large icons" },
  { id: "icons-lg", label: "Large icons" },
  { id: "icons-md", label: "Medium icons" },
  { id: "icons-sm", label: "Small icons", sep: true },
  { id: "list", label: "List" },
  { id: "details", label: "Details", sep: true },
  { id: "tiles", label: "Tiles" },
] as const;

type ViewMode = (typeof VIEWS)[number]["id"];
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
function storedView(): ViewMode {
  const value = window.localStorage.getItem(VIEW_KEY);
  return isViewMode(value) ? value : "details";
}
const serverView = (): ViewMode => "details";
function saveView(mode: ViewMode): void {
  window.localStorage.setItem(VIEW_KEY, mode);
  for (const listener of viewListeners) listener();
}

const modifiedOn = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

const selectKey = (entry: Entry): string | null =>
  entry.kind === "file" ? `f:${entry.id}` : entry.kind === "folder" ? `d:${entry.id}` : null;

const parentPath = (index: TreeIndex, folderId: string | null): string =>
  folderId && index.folders.has(folderId) ? folderPath(index, folderId) : "";

/** Icon views large enough that a photo is worth fetching; list and details stay glyphs. */
const showsThumb = (view: ViewMode): boolean => view === "icons-md" || view === "icons-lg" || view === "icons-xl" || view === "tiles";

function EntryGlyph({ entry, token, thumb }: { entry: Entry; token: string; thumb: boolean }): ReactElement {
  if (entry.kind === "folder") return <Icon name="folder" className={styles.folder} />;
  if (entry.kind === "summary") return <Icon name="summary" className={styles.summaryGlyph} />;
  const kind = fileKind(entry.file.name);
  if (thumb && kind === "image" && entry.file.sizeBytes <= THUMB_MAX_BYTES) {
    return <Thumb src={`${sharedFilePath(token, entry.file.id)}?thumb=1`} />;
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

export function SharedRoom({
  token,
  roomName,
  tree,
  osHref,
  summary,
}: {
  token: string;
  roomName: string;
  tree: RoomTree;
  osHref: string;
  summary: RoomSummary | null;
}): ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const menuId = useId();
  const index = useMemo(() => indexTree(tree), [tree]);
  const requestedFolder = searchParams.get("folder");
  const folderId = requestedFolder && index.folders.has(requestedFolder) ? requestedFolder : null;
  const openFile = tree.files.find((file) => file.id === searchParams.get("file")) ?? null;
  const summaryOpen = Boolean(summary) && !openFile && searchParams.get("summary") === "1";

  const [query, setQuery] = useState("");
  const view = useSyncExternalStore(subscribeView, storedView, serverView);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [download, setDownload] = useState<ZipProgress | "preparing" | null>(null);
  const downloadAbort = useRef<AbortController | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const allRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const go = (next: { folder?: string | null; file?: string | null; summary?: boolean }) => {
    setChecked(new Set());
    const folder = next.folder === undefined ? folderId : next.folder;
    const params = new URLSearchParams();
    if (folder) params.set("folder", folder);
    if (next.file) params.set("file", next.file);
    if (next.summary) params.set("summary", "1");
    const search = params.toString();
    router.push(search ? `${pathname}?${search}` : pathname, { scroll: false });
  };

  const entries = (() => {
    const needle = query.trim().toLowerCase();
    let rows: Entry[];
    if (needle) {
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
        ...(summary && !folderId
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

  const chooseView = (mode: ViewMode) => {
    saveView(mode);
    setMenuOpen(false);
  };

  const toggleSort = (key: SortKey) => {
    setSort((current) => (current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  };

  const toggleChecked = (key: string) => {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openEntry = (entry: Entry) => {
    setQuery("");
    if (entry.kind === "summary") go({ folder: null, summary: true });
    else if (entry.kind === "folder") go({ folder: entry.id });
    else {
      const parent = entry.file.folderId && index.folders.has(entry.file.folderId) ? entry.file.folderId : null;
      go({ folder: parent, file: entry.file.id });
    }
  };

  const selectedBytes = () => {
    const folders = new Set([...checked].filter((key) => key.startsWith("d:")).map((key) => key.slice(2)));
    const files = new Set([...checked].filter((key) => key.startsWith("f:")).map((key) => key.slice(2)));
    return tree.files
      .filter(
        (file) =>
          files.has(file.id) ||
          (file.folderId !== null && [file.folderId, ...ancestorsOf(index, file.folderId)].some((id) => folders.has(id))),
      )
      .reduce((sum, file) => sum + file.sizeBytes, 0);
  };

  const downloadSelected = async () => {
    if (download || !tree.files.length) return;
    const picked = entries.flatMap((entry) => {
      const key = selectKey(entry);
      if (!key || !checked.has(key) || entry.kind === "summary") return [];
      return [{ kind: entry.kind, id: entry.id }];
    });
    const everything = picked.length === 0;
    const rootItems = [
      ...(index.childFolders.get(null) ?? []).map((folder) => ({ kind: "folder" as const, id: folder.id })),
      ...(index.childFiles.get(null) ?? []).map((file) => ({ kind: "file" as const, id: file.id })),
    ];
    const items = everything ? rootItems : picked;
    if (!items.length) return;
    if (items.length === 1 && items[0].kind === "file") {
      window.location.assign(`${sharedFilePath(token, items[0].id)}?download=1`);
      return;
    }
    const bytes = everything ? tree.files.reduce((sum, file) => sum + file.sizeBytes, 0) : selectedBytes();
    const selection: ZipSelection = everything
      ? { all: true }
      : {
          files: items.filter((item) => item.kind === "file").map((item) => item.id),
          folders: items.filter((item) => item.kind === "folder").map((item) => item.id),
        };
    const controller = new AbortController();
    downloadAbort.current = controller;
    setNotice(null);
    setDownload("preparing");
    try {
      const result = await downloadRoomZip({
        manifestUrl: `/api/shared/data-rooms/${encodeURIComponent(token)}/manifest`,
        roomName,
        selection,
        signal: controller.signal,
        onProgress: setDownload,
      });
      if (result === "unsupported") {
        if (bytes > MAX_ARCHIVE_BYTES) {
          setNotice(
            `This browser can only zip up to ${formatBytes(MAX_ARCHIVE_BYTES)} at a time, and this is ${formatBytes(bytes)}. ` +
              "Use Chrome or Edge to download it all at once, or download fewer folders at a time.",
          );
        } else {
          postRoomArchive(`/api/shared/data-rooms/${encodeURIComponent(token)}/archive`, items);
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setNotice(error instanceof Error && error.message ? error.message : "The download failed. Try again.");
      }
    } finally {
      downloadAbort.current = null;
      setDownload(null);
    }
  };

  const copyLink = async () => {
    if (await copyText(`${window.location.origin}${sharedRoomPath(token)}`)) setCopied(true);
  };

  const trail = folderId ? [...ancestorsOf(index, folderId), folderId] : [];
  const searching = query.trim().length > 0;
  const title = searching ? "Search" : folderId ? (index.folders.get(folderId)?.name ?? roomName) : roomName;
  const thumb = showsThumb(view);
  const closePreview = () => {
    const parent = openFile?.folderId && index.folders.has(openFile.folderId) ? openFile.folderId : folderId;
    go({ folder: parent });
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

  return (
    <div className={styles.page} data-theme="dark">
      <header className={styles.toolbar}>
        <a className={styles.mark} href={osHref} aria-label="Open in ZODE">
          {/* The wordmark is white; this page is always the dark browser. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/wordmark.png" alt="" />
        </a>
        <label className={styles.search}>
          <Icon name="search" />
          <input
            type="search"
            value={query}
            placeholder="Search"
            aria-label="Search files"
            onChange={(event) => {
              setQuery(event.target.value);
              setChecked(new Set());
            }}
          />
        </label>
        <div className={styles.tools}>
          {download ? (
            <>
              <span className={styles.progress} role="status">
                {download === "preparing"
                  ? "Preparing…"
                  : `${download.files.toLocaleString()} of ${download.totalFiles.toLocaleString()}`}
              </span>
              <button type="button" className={styles.tool} onClick={() => downloadAbort.current?.abort()}>
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              className={styles.tool}
              onClick={downloadSelected}
              disabled={!tree.files.length}
              aria-label={someSelected ? "Download selected" : "Download all"}
            >
              <Icon name="download" />
              <span className={styles.toolLabel}>{someSelected ? "Download" : "Download all"}</span>
            </button>
          )}
          <button type="button" className={styles.tool} onClick={copyLink} aria-label={copied ? "Link copied" : "Copy link"}>
            <Icon name={copied ? "check" : "link"} />
            <span className={styles.toolLabel}>{copied ? "Copied" : "Copy link"}</span>
          </button>
          <div className={styles.menuWrap} ref={menuRef}>
            <button
              type="button"
              className={styles.tool}
              aria-label="View"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <Icon name="grid" />
              <Icon name="arrowDown" />
            </button>
            {menuOpen ? (
              <ul id={menuId} className={styles.menu} role="menu" aria-label="View">
                {VIEWS.map((item) => (
                  <li key={item.id} role="none" data-sep={"sep" in item ? "" : undefined}>
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={view === item.id}
                      onClick={() => chooseView(item.id)}
                    >
                      <Icon name="check" />
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </header>

      {notice ? (
        <p className={styles.notice} role="alert">
          {notice}
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
            <Icon name="close" />
          </button>
        </p>
      ) : null}

      {openFile ? (
        <div className={styles.preview}>
          <FilePreview
            key={openFile.id}
            url={sharedFilePath(token, openFile.id)}
            file={openFile}
            showBack
            leading={
              <button type="button" className={`${ui.iconButton} ${viewer.back}`} onClick={closePreview} aria-label="Back to files">
                <Icon name="back" />
              </button>
            }
          />
        </div>
      ) : summary && summaryOpen ? (
        <div className={styles.preview}>
          <SummaryPanel summary={summary} showBack onBack={() => go({ folder: null })} onOpenFile={(fileId) => go({ file: fileId })} />
        </div>
      ) : (
        <div className={styles.browser}>
          <div className={styles.heading}>
            {searching ? (
              <p className={styles.crumb}>
                {entries.length.toLocaleString()} {entries.length === 1 ? "match" : "matches"} for “{query.trim()}”
              </p>
            ) : trail.length ? (
              <nav className={styles.crumb} aria-label="Folder">
                <button type="button" onClick={() => go({ folder: null })}>
                  {roomName}
                </button>
                {trail.map((id, i) => (
                  <span key={id}>
                    <span aria-hidden="true">/</span>
                    {i === trail.length - 1 ? (
                      <span aria-current="location">{index.folders.get(id)?.name}</span>
                    ) : (
                      <button type="button" onClick={() => go({ folder: id })}>
                        {index.folders.get(id)?.name}
                      </button>
                    )}
                  </span>
                ))}
              </nav>
            ) : (
              <p className={styles.crumb}>Data room</p>
            )}
            <h1>{title}</h1>
          </div>
          <div className={styles.scroller} data-view={view}>
            {entries.length === 0 ? (
              <p className={styles.empty}>{searching ? "Nothing matches that search." : "This folder is empty."}</p>
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
                        onChange={() => setChecked(allSelected ? new Set() : new Set(selectable))}
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
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                      <tr key={entry.kind + entry.id} data-selected={isChecked(entry) ? "" : undefined}>
                        <td className={styles.checkCol}>{checkbox(entry)}</td>
                        <td>
                          <button type="button" className={styles.nameButton} onClick={() => openEntry(entry)}>
                            <EntryGlyph entry={entry} token={token} thumb={false} />
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
                      </tr>
                  ))}
                </tbody>
              </table>
            ) : view === "list" ? (
              <ul className={styles.list}>
                {entries.map((entry) => (
                  <li key={entry.kind + entry.id} data-selected={isChecked(entry) ? "" : undefined}>
                    {checkbox(entry)}
                    <button type="button" className={styles.listButton} onClick={() => openEntry(entry)}>
                      <EntryGlyph entry={entry} token={token} thumb={false} />
                      <span>{entry.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : view === "tiles" ? (
              <ul className={styles.tiles}>
                {entries.map((entry) => (
                  <li key={entry.kind + entry.id} data-selected={isChecked(entry) ? "" : undefined}>
                    {checkbox(entry)}
                    <button type="button" onClick={() => openEntry(entry)}>
                      <EntryGlyph entry={entry} token={token} thumb={thumb} />
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
                  </li>
                ))}
              </ul>
            ) : (
              <ul className={styles.icons}>
                {entries.map((entry) => (
                  <li key={entry.kind + entry.id} data-selected={isChecked(entry) ? "" : undefined}>
                    {checkbox(entry)}
                    <button type="button" onClick={() => openEntry(entry)}>
                      <EntryGlyph entry={entry} token={token} thumb={thumb} />
                      <span className={styles.iconName}>{entry.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
