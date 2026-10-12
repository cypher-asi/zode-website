"use client";

import { Fragment, useMemo, useRef, useState, type ReactElement } from "react";
import {
  createFolderAction,
  deleteItemsAction,
  moveItemsAction,
  renameItemAction,
  type ItemRef,
} from "./actions";
import { Dialog, type DialogProps } from "./Dialog";
import { formatBytes } from "./fileKinds";
import { FileTree, ancestorsOf, folderPath, indexTree, type TreeAction } from "./FileTree";
import { Icon } from "./icons";
import { Splitter } from "./Splitter";
import { MAX_ARCHIVE_BYTES, type RoomFile, type RoomTree } from "./types";
import { useUploads } from "./useUploads";
import { SummaryPanel, Viewer, type RoomSummary } from "./Viewer";
import styles from "./DataRoomApp.module.css";
import ui from "./ui.module.css";

interface DataRoomAppProps {
  roomId: string;
  isAdmin: boolean;
  tree: RoomTree;
  initialFileId: string | null;
  summary: RoomSummary | null;
}

/**
 * The data room itself: the file tree on the left, a resizable divider, and
 * the viewer on the right. The summary, when written, is pinned atop the tree
 * and open until a file is.
 */
export function DataRoomApp({ roomId, isAdmin, tree, initialFileId, summary }: DataRoomAppProps): ReactElement {
  const index = useMemo(() => indexTree(tree), [tree]);
  const filesById = useMemo(() => new Map(tree.files.map((file) => [file.id, file])), [tree]);

  const [openFileId, setOpenFileId] = useState<string | null>(() =>
    initialFileId && filesById.has(initialFileId) ? initialFileId : null,
  );
  const [summaryOpen, setSummaryOpen] = useState(
    () => Boolean(summary) && !(initialFileId && filesById.has(initialFileId)),
  );
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const file = initialFileId ? filesById.get(initialFileId) : undefined;
    const folder = file?.folderId ?? null;
    return new Set(folder ? [...ancestorsOf(index, folder), folder] : []);
  });
  const [checkedRaw, setChecked] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<Omit<DialogProps, "onClose"> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const uploads = useUploads(roomId);

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const archiveRef = useRef<HTMLFormElement>(null);

  const openFile = openFileId ? (filesById.get(openFileId) ?? null) : null;
  const folderId = activeFolderId && index.folders.has(activeFolderId) ? activeFolderId : null;
  const trail = folderId ? [...ancestorsOf(index, folderId), folderId] : [];

  // Drop selections whose items were deleted or moved out from under us.
  const checked = useMemo(
    () =>
      new Set(
        [...checkedRaw].filter((key) => (key.startsWith("d:") ? index.folders.has(key.slice(2)) : filesById.has(key.slice(2)))),
      ),
    [checkedRaw, index, filesById],
  );
  const checkedRefs: ItemRef[] = [...checked].map((key) => ({
    kind: key.startsWith("d:") ? "folder" : "file",
    id: key.slice(2),
  }));

  const totalBytes = useMemo(() => tree.files.reduce((sum, file) => sum + file.sizeBytes, 0), [tree]);

  const open = (file: RoomFile) => {
    setOpenFileId(file.id);
    setSummaryOpen(false);
    setActiveFolderId(file.folderId);
    window.history.replaceState(null, "", `?file=${file.id}`);
  };

  const openSummary = () => {
    setOpenFileId(null);
    setSummaryOpen(true);
    window.history.replaceState(null, "", window.location.pathname);
  };

  const closeViewer = () => {
    setOpenFileId(null);
    setSummaryOpen(false);
    window.history.replaceState(null, "", window.location.pathname);
  };

  const toggleExpand = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const expandTo = (id: string | null) => {
    if (!id) return;
    setExpanded((current) => new Set([...current, ...ancestorsOf(index, id), id]));
  };

  const openById = (fileId: string) => {
    const file = filesById.get(fileId);
    if (!file) return;
    expandTo(file.folderId);
    open(file);
  };

  const toggleCheck = (key: string) =>
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const nameOf = (item: ItemRef): string =>
    item.kind === "folder" ? (index.folders.get(item.id)?.name ?? "") : (filesById.get(item.id)?.name ?? "");

  /** Folders an item can move into: not itself or anything under it. */
  const moveTargets = (items: ItemRef[]) => {
    const blocked = new Set(items.filter((i) => i.kind === "folder").map((i) => i.id));
    const insideBlocked = (id: string) => [...ancestorsOf(index, id), id].some((a) => blocked.has(a));
    return [
      { value: "", label: "All files (top level)" },
      ...[...index.folders.keys()]
        .filter((id) => !insideBlocked(id))
        .map((id) => ({ value: id, label: folderPath(index, id) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ];
  };

  const runAction = (action: TreeAction, items: ItemRef[]) => {
    if (!items.length) return;
    const single = items.length === 1 ? items[0] : null;
    if (action === "rename" && single) {
      setDialog({
        title: `Rename ${single.kind}`,
        input: { label: "Name", initial: nameOf(single) },
        confirmLabel: "Rename",
        onConfirm: async (name) => (await renameItemAction(roomId, single, name)).error,
      });
    } else if (action === "move") {
      const current = single
        ? single.kind === "folder"
          ? index.folders.get(single.id)?.parentId
          : filesById.get(single.id)?.folderId
        : null;
      setDialog({
        title: single ? `Move “${nameOf(single)}”` : `Move ${items.length} items`,
        choice: { label: "Destination", options: moveTargets(items), initial: current ?? "" },
        confirmLabel: "Move",
        onConfirm: async (target) => {
          const result = await moveItemsAction(roomId, items, target || null);
          if (!result.error) expandTo(target || null);
          return result.error;
        },
      });
    } else if (action === "delete") {
      const folders = items.filter((i) => i.kind === "folder").length;
      setDialog({
        title: single ? `Delete “${nameOf(single)}”?` : `Delete ${items.length} items?`,
        description: `${folders ? "Folders are deleted with everything inside them. " : ""}Members lose access immediately. The activity log keeps a record.`,
        confirmLabel: "Delete",
        danger: true,
        onConfirm: async () => {
          const result = await deleteItemsAction(roomId, items);
          if (!result.error) {
            setChecked(new Set());
            if (openFileId && items.some((i) => i.kind === "file" && i.id === openFileId)) closeViewer();
          }
          return result.error;
        },
      });
    }
  };

  const newFolder = () =>
    setDialog({
      title: "New folder",
      description: `In ${folderPath(index, folderId)}`,
      input: { label: "Folder name", initial: "" },
      confirmLabel: "Create",
      onConfirm: async (name) => {
        const result = await createFolderAction(roomId, folderId, name);
        if (result.id) {
          expandTo(folderId);
          setActiveFolderId(result.id);
        }
        return result.error;
      },
    });

  const startUpload = (files: File[], target: string | null) => {
    if (!files.length) return;
    expandTo(target);
    uploads.start(files, target);
  };

  const move = async (items: ItemRef[], target: string | null) => {
    const result = await moveItemsAction(roomId, items, target);
    if (result.error) setNotice(result.error);
    else expandTo(target);
  };

  /** Bytes a zip of the checked files and folders would hold, counting each file once. */
  const selectedBytes = () => {
    const folders = new Set(checkedRefs.filter((item) => item.kind === "folder").map((item) => item.id));
    const files = new Set(checkedRefs.filter((item) => item.kind === "file").map((item) => item.id));
    return tree.files
      .filter(
        (file) =>
          files.has(file.id) ||
          (file.folderId !== null && [...ancestorsOf(index, file.folderId), file.folderId].some((id) => folders.has(id))),
      )
      .reduce((sum, file) => sum + file.sizeBytes, 0);
  };

  const downloadSelected = () => {
    if (checkedRefs.length === 1 && checkedRefs[0].kind === "file") {
      window.location.assign(`/api/data-rooms/${roomId}/files/${checkedRefs[0].id}?download=1`);
      return;
    }
    const bytes = selectedBytes();
    if (bytes > MAX_ARCHIVE_BYTES) {
      setNotice(
        `That selection is ${formatBytes(bytes)}; zip downloads are limited to ${formatBytes(MAX_ARCHIVE_BYTES)}. ` +
          "Download fewer folders at a time, or large files individually.",
      );
      return;
    }
    archiveRef.current?.requestSubmit();
  };

  const activeUploads = uploads.items.filter((item) => item.status === "uploading" || item.status === "queued").length;

  return (
    <div ref={containerRef} className={styles.app} data-view={openFile || summaryOpen ? "viewer" : "tree"}>
      <section className={styles.side} aria-label="Files">
        <div className={styles.toolbar}>
          <label className={styles.search}>
            <Icon name="search" />
            <input
              type="search"
              placeholder="Search files"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search files"
            />
          </label>
          {isAdmin ? (
            <>
              <button type="button" className={ui.iconButton} onClick={newFolder} aria-label="New folder" title="New folder">
                <Icon name="folderPlus" />
              </button>
              <button type="button" className={ui.primary} onClick={() => fileInputRef.current?.click()}>
                <Icon name="upload" />
                Upload
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={(event) => {
                  startUpload([...(event.target.files ?? [])], folderId);
                  event.target.value = "";
                }}
              />
            </>
          ) : null}
        </div>
        <nav className={styles.location} aria-label="Current folder">
          <button
            type="button"
            onClick={() => setActiveFolderId(null)}
            aria-current={folderId ? undefined : "location"}
            aria-label="All files"
            title="All files"
          >
            /
          </button>
          {trail.map((id, i) => (
            <Fragment key={id}>
              {i > 0 ? <span aria-hidden="true">/</span> : null}
              <button
                type="button"
                onClick={() => setActiveFolderId(id)}
                aria-current={id === folderId ? "location" : undefined}
              >
                {index.folders.get(id)?.name}
              </button>
            </Fragment>
          ))}
        </nav>

        <FileTree
          index={index}
          isAdmin={isAdmin}
          query={query}
          openFileId={openFileId}
          activeFolderId={folderId}
          checked={checked}
          expanded={expanded}
          onToggleExpand={toggleExpand}
          onToggleCheck={toggleCheck}
          onOpenFile={open}
          onSelectFolder={setActiveFolderId}
          onAction={(action, item) => runAction(action, [item])}
          onDropFiles={startUpload}
          onMove={move}
          summary={summary ? { open: summaryOpen, onOpen: openSummary } : undefined}
        />

        {uploads.items.length ? (
          <div className={styles.uploads} aria-live="polite">
            <div className={styles.uploadsHeader}>
              <span>{activeUploads ? `Uploading ${activeUploads} file${activeUploads === 1 ? "" : "s"}…` : "Uploads"}</span>
              {activeUploads ? null : (
                <button type="button" onClick={uploads.dismiss}>
                  Dismiss
                </button>
              )}
            </div>
            <ul>
              {uploads.items.map((item) => (
                <li key={item.id} data-status={item.status}>
                  <span className={styles.uploadName}>{item.name}</span>
                  <span className={styles.uploadState}>
                    {item.status === "error" ? item.error : item.status === "done" ? "Done" : `${item.progress}%`}
                  </span>
                  <span className={styles.uploadBar} style={{ width: `${item.progress}%` }} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {notice ? (
          <p className={styles.notice} role="alert">
            {notice}
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
              <Icon name="close" />
            </button>
          </p>
        ) : null}

        <div className={styles.footer}>
          {checked.size ? (
            <>
              <span className={styles.count}>{checked.size} selected</span>
              <button type="button" className={styles.linkButton} onClick={() => setChecked(new Set())}>
                Clear
              </button>
              {isAdmin ? (
                <>
                  <button type="button" className={styles.linkButton} onClick={() => runAction("move", checkedRefs)}>
                    Move
                  </button>
                  <button
                    type="button"
                    className={styles.linkButton}
                    data-danger=""
                    onClick={() => runAction("delete", checkedRefs)}
                  >
                    Delete
                  </button>
                </>
              ) : null}
              <button type="button" className={ui.primary} onClick={downloadSelected}>
                <Icon name="download" />
                Download
              </button>
            </>
          ) : (
            <span className={styles.count}>
              {tree.files.length} file{tree.files.length === 1 ? "" : "s"} · {formatBytes(totalBytes)}
            </span>
          )}
        </div>

        <form ref={archiveRef} method="post" action={`/api/data-rooms/${roomId}/archive`} hidden>
          {checkedRefs.map((item) => (
            <input key={`${item.kind}:${item.id}`} type="hidden" name={item.kind} value={item.id} />
          ))}
        </form>
      </section>

      <Splitter containerRef={containerRef} storageKey="zode:data-room:tree-share" />

      <section className={styles.main} aria-label="Viewer">
        {summary && summaryOpen ? (
          <SummaryPanel summary={summary} onBack={closeViewer} onOpenFile={openById} />
        ) : (
          <Viewer key={openFile?.id ?? "none"} roomId={roomId} file={openFile} onBack={closeViewer} />
        )}
      </section>

      {dialog ? <Dialog {...dialog} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
