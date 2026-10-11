"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type ReactElement } from "react";
import type { ItemRef } from "./actions";
import { fileKind, formatBytes } from "./fileKinds";
import { FileGlyph, Icon } from "./icons";
import type { RoomFile, RoomFolder, RoomTree } from "./types";
import styles from "./DataRoomApp.module.css";

export const fileKey = (id: string): string => `f:${id}`;
export const folderKey = (id: string): string => `d:${id}`;

const DRAG_TYPE = "application/x-zode-data-room-items";

export type TreeAction = "rename" | "move" | "delete";

interface Row {
  key: string;
  depth: number;
  folder?: RoomFolder;
  file?: RoomFile;
  childCount: number;
}

export interface TreeIndex {
  folders: Map<string, RoomFolder>;
  childFolders: Map<string | null, RoomFolder[]>;
  childFiles: Map<string | null, RoomFile[]>;
}

export function indexTree(tree: RoomTree): TreeIndex {
  const folders = new Map(tree.folders.map((folder) => [folder.id, folder]));
  const childFolders = new Map<string | null, RoomFolder[]>();
  const childFiles = new Map<string | null, RoomFile[]>();
  for (const folder of tree.folders) {
    const parent = folder.parentId && folders.has(folder.parentId) ? folder.parentId : null;
    childFolders.set(parent, [...(childFolders.get(parent) ?? []), folder]);
  }
  for (const file of tree.files) {
    const parent = file.folderId && folders.has(file.folderId) ? file.folderId : null;
    childFiles.set(parent, [...(childFiles.get(parent) ?? []), file]);
  }
  return { folders, childFolders, childFiles };
}

/** Folder ids from the root down to `folderId`'s parent. */
export function ancestorsOf(index: TreeIndex, folderId: string | null): string[] {
  const chain: string[] = [];
  for (let id = folderId, depth = 0; id && depth < 64; depth += 1) {
    const parent = index.folders.get(id)?.parentId ?? null;
    if (parent) chain.unshift(parent);
    id = parent;
  }
  return chain;
}

/** "Folder / Subfolder" for display, or "All files" at the root. */
export function folderPath(index: TreeIndex, folderId: string | null): string {
  if (!folderId || !index.folders.has(folderId)) return "All files";
  return [...ancestorsOf(index, folderId), folderId].map((id) => index.folders.get(id)?.name ?? "").join(" / ");
}

function visibleRows(index: TreeIndex, expanded: Set<string>, query: string): Row[] {
  const needle = query.trim().toLowerCase();
  const rows: Row[] = [];

  // While searching, a folder shows if it or anything under it matches, and is opened.
  const matches = new Map<string | null, boolean>();
  const folderMatches = (folderId: string): boolean => {
    if (matches.has(folderId)) return matches.get(folderId)!;
    const folder = index.folders.get(folderId)!;
    const result =
      folder.name.toLowerCase().includes(needle) ||
      (index.childFiles.get(folderId) ?? []).some((file) => file.name.toLowerCase().includes(needle)) ||
      (index.childFolders.get(folderId) ?? []).some((child) => folderMatches(child.id));
    matches.set(folderId, result);
    return result;
  };

  const walk = (parent: string | null, depth: number) => {
    for (const folder of index.childFolders.get(parent) ?? []) {
      if (needle && !folderMatches(folder.id)) continue;
      const childCount = (index.childFolders.get(folder.id)?.length ?? 0) + (index.childFiles.get(folder.id)?.length ?? 0);
      rows.push({ key: folderKey(folder.id), depth, folder, childCount });
      if (needle || expanded.has(folder.id)) walk(folder.id, depth + 1);
    }
    for (const file of index.childFiles.get(parent) ?? []) {
      if (needle && !file.name.toLowerCase().includes(needle)) continue;
      rows.push({ key: fileKey(file.id), depth, file, childCount: 0 });
    }
  };
  walk(null, 0);
  return rows;
}

export interface FileTreeProps {
  index: TreeIndex;
  isAdmin: boolean;
  query: string;
  openFileId: string | null;
  activeFolderId: string | null;
  checked: Set<string>;
  expanded: Set<string>;
  onToggleExpand: (folderId: string) => void;
  onToggleCheck: (key: string) => void;
  onOpenFile: (file: RoomFile) => void;
  onSelectFolder: (folderId: string | null) => void;
  onAction: (action: TreeAction, item: ItemRef) => void;
  onDropFiles: (files: File[], folderId: string | null) => void;
  onMove: (items: ItemRef[], folderId: string | null) => void;
}

export function FileTree({
  index,
  isAdmin,
  query,
  openFileId,
  activeFolderId,
  checked,
  expanded,
  onToggleExpand,
  onToggleCheck,
  onOpenFile,
  onSelectFolder,
  onAction,
  onDropFiles,
  onMove,
}: FileTreeProps): ReactElement {
  const rows = useMemo(() => visibleRows(index, expanded, query), [index, expanded, query]);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const currentFocus = rows.some((row) => row.key === focusKey) ? focusKey : (rows[0]?.key ?? null);

  useEffect(() => {
    if (!menuKey) return;
    const close = (event: PointerEvent) => {
      if (!(event.target as Element).closest(`[data-menu]`)) setMenuKey(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuKey]);

  /** Checked directly, or inside a checked folder. */
  const isChecked = (row: Row): { on: boolean; inherited: boolean } => {
    if (checked.has(row.key)) return { on: true, inherited: false };
    const parent = row.folder ? row.folder.parentId : (row.file?.folderId ?? null);
    const chain = parent && index.folders.has(parent) ? [...ancestorsOf(index, parent), parent] : [];
    return chain.some((id) => checked.has(folderKey(id))) ? { on: true, inherited: true } : { on: false, inherited: false };
  };

  const refOf = (row: Row): ItemRef => (row.folder ? { kind: "folder", id: row.folder.id } : { kind: "file", id: row.file!.id });

  const focusRow = (key: string | undefined) => {
    if (!key) return;
    setFocusKey(key);
    listRef.current?.querySelector<HTMLElement>(`[data-key="${key}"]`)?.focus();
  };

  const activate = (row: Row) => {
    if (row.folder) {
      onToggleExpand(row.folder.id);
      onSelectFolder(row.folder.id);
    } else if (row.file) {
      onOpenFile(row.file);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, row: Row, i: number) => {
    if (event.target !== event.currentTarget) return;
    const folderOpen = row.folder ? query.trim() !== "" || expanded.has(row.folder.id) : false;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusRow(rows[i + 1]?.key);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusRow(rows[i - 1]?.key);
        break;
      case "Home":
        event.preventDefault();
        focusRow(rows[0]?.key);
        break;
      case "End":
        event.preventDefault();
        focusRow(rows[rows.length - 1]?.key);
        break;
      case "ArrowRight":
        event.preventDefault();
        if (row.folder && !folderOpen) onToggleExpand(row.folder.id);
        else if (row.folder) focusRow(rows[i + 1]?.key);
        break;
      case "ArrowLeft": {
        event.preventDefault();
        if (row.folder && folderOpen && !query.trim()) {
          onToggleExpand(row.folder.id);
        } else {
          const parent = row.folder ? row.folder.parentId : (row.file?.folderId ?? null);
          if (parent) focusRow(folderKey(parent));
        }
        break;
      }
      case "Enter":
        event.preventDefault();
        activate(row);
        break;
      case " ":
        event.preventDefault();
        if (!isChecked(row).inherited) onToggleCheck(row.key);
        break;
      case "F2":
        if (isAdmin) {
          event.preventDefault();
          onAction("rename", refOf(row));
        }
        break;
      case "Delete":
        if (isAdmin) {
          event.preventDefault();
          onAction("delete", refOf(row));
        }
        break;
    }
  };

  const dragItems = (row: Row): ItemRef[] => {
    if (!checked.has(row.key)) return [refOf(row)];
    return [...checked].map((key) => ({ kind: key.startsWith("d:") ? "folder" : "file", id: key.slice(2) }) as ItemRef);
  };

  const dropProps = (key: string, folderId: string | null) =>
    isAdmin
      ? {
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
              onDropFiles([...event.dataTransfer.files], folderId);
              return;
            }
            const raw = event.dataTransfer.getData(DRAG_TYPE);
            if (!raw) return;
            const items = (JSON.parse(raw) as ItemRef[]).filter((item) => !(item.kind === "folder" && item.id === folderId));
            if (items.length) onMove(items, folderId);
          },
        }
      : {};

  return (
    <div
      ref={listRef}
      className={styles.tree}
      role="tree"
      aria-label="Files"
      aria-multiselectable="true"
      data-drop={dropKey === "root" ? "" : undefined}
      {...dropProps("root", null)}
      onClick={(event) => {
        if (event.target === event.currentTarget) onSelectFolder(null);
      }}
    >
      {rows.length === 0 ? (
        <div className={styles.treeEmpty}>
          {query.trim() ? (
            <p>No files match “{query.trim()}”.</p>
          ) : isAdmin ? (
            <p>This room is empty. Drop files here or use Upload.</p>
          ) : (
            <p>No files have been shared in this room yet.</p>
          )}
        </div>
      ) : null}
      {rows.map((row, i) => {
        const { on, inherited } = isChecked(row);
        const name = row.folder?.name ?? row.file!.name;
        const folderOpen = row.folder ? query.trim() !== "" || expanded.has(row.folder.id) : undefined;
        const current = row.file ? row.file.id === openFileId : row.folder!.id === activeFolderId;
        return (
          <div
            key={row.key}
            data-key={row.key}
            role="treeitem"
            aria-level={row.depth + 1}
            aria-expanded={folderOpen}
            aria-selected={on}
            aria-current={current ? "true" : undefined}
            tabIndex={row.key === currentFocus ? 0 : -1}
            className={styles.row}
            data-drop={dropKey === row.key ? "" : undefined}
            style={{ paddingLeft: 8 + row.depth * 18 }}
            onClick={() => {
              setFocusKey(row.key);
              activate(row);
            }}
            onFocus={() => setFocusKey(row.key)}
            onKeyDown={(event) => onKeyDown(event, row, i)}
            draggable={isAdmin}
            onDragStart={(event) => {
              event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(dragItems(row)));
              event.dataTransfer.effectAllowed = "move";
            }}
            {...(row.folder ? dropProps(row.key, row.folder.id) : {})}
          >
            <input
              type="checkbox"
              className={styles.check}
              checked={on}
              disabled={inherited}
              tabIndex={-1}
              aria-label={`Select ${name}`}
              onClick={(event) => event.stopPropagation()}
              onChange={() => onToggleCheck(row.key)}
            />
            {row.folder ? (
              <Icon name="chevron" className={styles.chevron} />
            ) : (
              <span className={styles.chevronSpacer} aria-hidden="true" />
            )}
            {row.folder ? (
              <Icon name="folder" className={styles.folderGlyph} />
            ) : (
              <FileGlyph kind={fileKind(row.file!.name)} className={styles.fileGlyph} />
            )}
            <span className={styles.rowName} title={name}>
              {name}
            </span>
            <span className={styles.rowMeta}>
              {row.file ? formatBytes(row.file.sizeBytes) : row.childCount ? row.childCount : ""}
            </span>
            {isAdmin ? (
              <span className={styles.rowMenu} data-menu>
                <button
                  type="button"
                  className={styles.rowMenuButton}
                  tabIndex={-1}
                  aria-label={`Actions for ${name}`}
                  aria-haspopup="menu"
                  aria-expanded={menuKey === row.key}
                  onClick={(event) => {
                    event.stopPropagation();
                    setMenuKey((current) => (current === row.key ? null : row.key));
                  }}
                >
                  <Icon name="more" />
                </button>
                {menuKey === row.key ? (
                  <div className={styles.menu} role="menu" onClick={(event) => event.stopPropagation()}>
                    {(["rename", "move", "delete"] as const).map((action) => (
                      <button
                        key={action}
                        type="button"
                        role="menuitem"
                        className={styles.menuItem}
                        data-danger={action === "delete" ? "" : undefined}
                        onClick={() => {
                          setMenuKey(null);
                          onAction(action, refOf(row));
                        }}
                      >
                        {action === "rename" ? "Rename" : action === "move" ? "Move to…" : "Delete"}
                      </button>
                    ))}
                  </div>
                ) : null}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
