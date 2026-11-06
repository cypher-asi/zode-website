"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type ReactElement } from "react";
import type { ItemRef } from "./actions";
import { fileKind } from "./fileKinds";
import { FileGlyph, Icon } from "./icons";
import { DRAG_TYPE, type BrowserAdmin } from "./RoomBrowser";
import { ancestorsOf, fileKey, folderKey, type TreeIndex } from "./tree";
import type { RoomFile } from "./types";
import styles from "./FolderTree.module.css";

const ROOT_KEY = "root";
const SUMMARY_KEY = "summary";
const INDENT = 16;

type Row =
  | { kind: "root"; key: string; depth: number }
  | { kind: "summary"; key: string; depth: number }
  | { kind: "folder"; key: string; depth: number; id: string; name: string; parentId: string | null; hasChildren: boolean }
  | { kind: "file"; key: string; depth: number; file: RoomFile };

export interface FolderTreeProps {
  index: TreeIndex;
  /** The top level's name, the tree's first row. */
  rootName: string;
  /** The folder on show, or the open file's. */
  folderId: string | null;
  openFileId: string | null;
  /** Pins a Summary row first, when the room has one. */
  summary: { open: boolean; onOpen: () => void } | null;
  onOpenFolder: (folderId: string | null) => void;
  onOpenFile: (file: RoomFile) => void;
  /** Lets admins drop files and dragged items onto a folder. */
  admin?: Pick<BrowserAdmin, "onDropFiles" | "onMove">;
}

/**
 * The room as Windows Explorer's navigation pane shows a drive: its folders and
 * files as a tree under the room, opened with the chevrons. A row opens its
 * folder or file in the browser, and the path to whatever is open there
 * unfolds and stays marked.
 */
export function FolderTree({
  index,
  rootName,
  folderId,
  openFileId,
  summary,
  onOpenFolder,
  onOpenFile,
  admin,
}: FolderTreeProps): ReactElement {
  const chain = useMemo(() => (folderId ? [...ancestorsOf(index, folderId), folderId] : []), [index, folderId]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(chain));
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const currentKey = summary?.open
    ? SUMMARY_KEY
    : openFileId
      ? fileKey(openFileId)
      : folderId
        ? folderKey(folderId)
        : ROOT_KEY;

  // Whatever opens in the browser, from here or anywhere else, has its folders unfolded.
  const [seen, setSeen] = useState({ currentKey, chain });
  if (seen.currentKey !== currentKey || seen.chain !== chain) {
    setSeen({ currentKey, chain });
    if (chain.some((id) => !expanded.has(id))) setExpanded(new Set([...expanded, ...chain]));
  }

  useEffect(() => {
    listRef.current?.querySelector(`[data-key="${currentKey}"]`)?.scrollIntoView({ block: "nearest" });
  }, [currentKey]);

  const rows = useMemo(() => {
    const list: Row[] = [{ kind: "root", key: ROOT_KEY, depth: 0 }];
    if (summary) list.push({ kind: "summary", key: SUMMARY_KEY, depth: 1 });
    const walk = (parent: string | null, depth: number) => {
      for (const folder of index.childFolders.get(parent) ?? []) {
        list.push({
          kind: "folder",
          key: folderKey(folder.id),
          depth,
          id: folder.id,
          name: folder.name,
          parentId: folder.parentId && index.folders.has(folder.parentId) ? folder.parentId : null,
          hasChildren: Boolean(index.childFolders.get(folder.id)?.length || index.childFiles.get(folder.id)?.length),
        });
        if (expanded.has(folder.id)) walk(folder.id, depth + 1);
      }
      for (const file of index.childFiles.get(parent) ?? []) list.push({ kind: "file", key: fileKey(file.id), depth, file });
    };
    walk(null, 1);
    return list;
  }, [index, expanded, summary]);

  const fileParents = useMemo(
    () => new Map([...index.childFiles].flatMap(([parent, files]) => files.map((file) => [file.id, parent] as const))),
    [index],
  );

  const focused = rows.some((row) => row.key === focusKey) ? focusKey : currentKey;

  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const activate = (row: Row) => {
    if (row.kind === "root") onOpenFolder(null);
    else if (row.kind === "summary") summary?.onOpen();
    else if (row.kind === "folder") onOpenFolder(row.id);
    else onOpenFile(row.file);
  };

  const focusRow = (row: Row | undefined) => {
    if (!row) return;
    setFocusKey(row.key);
    listRef.current?.querySelector<HTMLElement>(`[data-key="${row.key}"]`)?.focus();
  };

  const parentRow = (row: Row): Row | undefined => {
    if (row.kind === "root") return undefined;
    const parent = row.kind === "folder" ? row.parentId : row.kind === "file" ? (fileParents.get(row.file.id) ?? null) : null;
    return rows.find((r) => r.key === (parent ? folderKey(parent) : ROOT_KEY));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, row: Row, i: number) => {
    const open = row.kind === "folder" && expanded.has(row.id);
    switch (event.key) {
      case "ArrowDown":
        focusRow(rows[i + 1]);
        break;
      case "ArrowUp":
        focusRow(rows[i - 1]);
        break;
      case "Home":
        focusRow(rows[0]);
        break;
      case "End":
        focusRow(rows.at(-1));
        break;
      case "ArrowRight":
        if (row.kind === "folder" && row.hasChildren && !open) toggle(row.id);
        else if (row.kind === "root" || open) focusRow(rows[i + 1]);
        break;
      case "ArrowLeft":
        if (open) toggle(row.id);
        else focusRow(parentRow(row));
        break;
      case "Enter":
        activate(row);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  /** Drops land in `target`, skipping items already there and folders dropped into themselves. */
  const dropProps = (key: string, target: string | null) =>
    admin
      ? {
          "data-drop": dropKey === key ? "" : undefined,
          onDragOver: (event: DragEvent) => {
            const types = event.dataTransfer.types;
            if (!types.includes("Files") && !types.includes(DRAG_TYPE)) return;
            event.preventDefault();
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
            setDropKey(null);
            if (event.dataTransfer.files.length) {
              admin.onDropFiles([...event.dataTransfer.files], target);
              return;
            }
            const raw = event.dataTransfer.getData(DRAG_TYPE);
            if (!raw) return;
            const into = target ? [...ancestorsOf(index, target), target] : [];
            const items = (JSON.parse(raw) as ItemRef[]).filter((item) =>
              item.kind === "folder"
                ? (index.folders.get(item.id)?.parentId ?? null) !== target && !into.includes(item.id)
                : (fileParents.get(item.id) ?? null) !== target,
            );
            if (items.length) admin.onMove(items, target);
          },
        }
      : {};

  return (
    <div ref={listRef} className={styles.tree} role="tree" aria-label="Folders">
      {rows.map((row, i) => {
        const open = row.kind === "folder" && expanded.has(row.id);
        const name =
          row.kind === "root" ? rootName : row.kind === "summary" ? "Summary" : row.kind === "folder" ? row.name : row.file.name;
        const current = row.key === currentKey;
        return (
          <div
            key={row.key}
            data-key={row.key}
            role="treeitem"
            aria-level={row.depth + 1}
            aria-expanded={row.kind === "folder" && row.hasChildren ? open : row.kind === "root" ? true : undefined}
            aria-selected={current}
            aria-current={current ? "location" : undefined}
            tabIndex={row.key === focused ? 0 : -1}
            className={styles.row}
            style={{ paddingLeft: 6 + row.depth * INDENT }}
            onClick={() => {
              setFocusKey(row.key);
              activate(row);
            }}
            onFocus={() => setFocusKey(row.key)}
            onKeyDown={(event) => onKeyDown(event, row, i)}
            {...(row.kind === "folder" ? dropProps(row.key, row.id) : row.kind === "root" ? dropProps(row.key, null) : {})}
          >
            {row.kind === "folder" && row.hasChildren ? (
              <span
                className={styles.chevron}
                data-open={open ? "" : undefined}
                onClick={(event) => {
                  event.stopPropagation();
                  toggle(row.id);
                }}
              >
                <Icon name="chevron" />
              </span>
            ) : (
              <span className={styles.chevron} />
            )}
            {row.kind === "file" ? (
              <FileGlyph kind={fileKind(row.file.name)} className={styles.fileGlyph} />
            ) : row.kind === "summary" ? (
              <Icon name="summary" className={styles.summaryGlyph} />
            ) : (
              <Icon name="folder" className={styles.folder} />
            )}
            <span className={styles.name} title={name}>
              {name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
