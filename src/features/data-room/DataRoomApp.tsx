"use client";

import { Activity, Fragment, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Menu } from "@/components/ui/Menu";
import { Splitter } from "@/components/ui/Splitter";
import { SidebarDock, useDocked } from "@/features/portal/PortalFrame";
import {
  createFolderAction,
  deleteItemsAction,
  moveItemsAction,
  renameItemAction,
  type ItemRef,
} from "./actions";
import { Dialog, type DialogProps } from "./Dialog";
import { formatBytes } from "./fileKinds";
import { FileTree, ancestorsOf, fileKey, folderKey, folderPath, indexTree, type TreeAction } from "./FileTree";
import { Icon } from "./icons";
import { MAX_ARCHIVE_BYTES, type RoomFile, type RoomTree } from "./types";
import { UploadList } from "./UploadList";
import { useUploads } from "./useUploads";
import { SummaryPanel, Viewer, type RoomSummary } from "./Viewer";
import { downloadRoomZip, type ZipProgress, type ZipSelection } from "./zipDownload";
import styles from "./DataRoomApp.module.css";
import ui from "./ui.module.css";

/** Posts the selection to the server's zip route, for browsers that can't zip on their own. */
function postArchive(roomId: string, items: ItemRef[]) {
  const form = document.createElement("form");
  form.method = "post";
  form.action = `/api/data-rooms/${roomId}/archive`;
  form.hidden = true;
  for (const item of items) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = item.kind;
    input.value = item.id;
    form.append(input);
  }
  document.body.append(form);
  form.submit();
  form.remove();
}

interface DataRoomAppProps {
  roomId: string;
  roomName: string;
  isAdmin: boolean;
  tree: RoomTree;
  summary: RoomSummary | null;
  /** The open tab's page; every tab but Files shows it in the viewer's place. */
  children: ReactNode;
}

/**
 * The data room itself: the file tree on the left, a resizable divider, and
 * the viewer on the right. While the portal's sidebar is showing, the tree
 * docks there instead and the viewer takes the whole panel; it stays docked
 * on the other tabs, where picking a file goes back to Files. The summary,
 * when written, is pinned atop the tree and open until a file is.
 */
export function DataRoomApp({ roomId, roomName, isAdmin, tree, summary, children }: DataRoomAppProps): ReactElement {
  const index = useMemo(() => indexTree(tree), [tree]);
  const filesById = useMemo(() => new Map(tree.files.map((file) => [file.id, file])), [tree]);

  const base = `/portal/data-rooms/${roomId}`;
  const router = useRouter();
  const onFiles = usePathname() === base;
  const searchParams = useSearchParams();
  const fileParam = onFiles ? searchParams.get("file") : null;
  const initialFileId = fileParam && filesById.has(fileParam) ? fileParam : null;

  const [openFileId, setOpenFileId] = useState<string | null>(initialFileId);
  const [summaryOpen, setSummaryOpen] = useState(() => Boolean(summary) && !initialFileId);
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
  /** The zip being saved: `preparing` until its first bytes arrive. */
  const [download, setDownload] = useState<ZipProgress | "preparing" | null>(null);
  const downloadAbort = useRef<AbortController | null>(null);
  const uploads = useUploads(roomId);
  const docked = useDocked();

  // Links into the room, e.g. Activity's "Open", name the file to show.
  const [seenFileParam, setSeenFileParam] = useState(fileParam);
  if (fileParam !== seenFileParam) {
    setSeenFileParam(fileParam);
    const file = fileParam ? filesById.get(fileParam) : undefined;
    if (file && file.id !== openFileId) {
      setOpenFileId(file.id);
      setSummaryOpen(false);
      setActiveFolderId(file.folderId);
      const folder = file.folderId;
      if (folder) setExpanded((current) => new Set([...current, ...ancestorsOf(index, folder), folder]));
    }
  }

  // Back on Files with a file still open, the address names it again.
  useEffect(() => {
    if (onFiles && openFileId && fileParam !== openFileId) window.history.replaceState(null, "", `?file=${openFileId}`);
  }, [onFiles, openFileId, fileParam]);

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  /** The top-level folders and files; checking them all checks everything. */
  const rootRefs = useMemo<ItemRef[]>(
    () => [
      ...(index.childFolders.get(null) ?? []).map((folder) => ({ kind: "folder" as const, id: folder.id })),
      ...(index.childFiles.get(null) ?? []).map((file) => ({ kind: "file" as const, id: file.id })),
    ],
    [index],
  );
  const refKey = (item: ItemRef) => (item.kind === "folder" ? folderKey(item.id) : fileKey(item.id));
  const allChecked = rootRefs.length > 0 && rootRefs.every((item) => checked.has(refKey(item)));
  const selectAll = () => setChecked(new Set(rootRefs.map(refKey)));

  /** Points the address at `href`, going back to Files from another tab. */
  const show = (href: string) => {
    if (onFiles) window.history.replaceState(null, "", href);
    else router.push(href);
  };

  const open = (file: RoomFile) => {
    setOpenFileId(file.id);
    setSummaryOpen(false);
    setActiveFolderId(file.folderId);
    show(`${base}?file=${file.id}`);
  };

  const openSummary = () => {
    setOpenFileId(null);
    setSummaryOpen(true);
    show(base);
  };

  const closeViewer = () => {
    setOpenFileId(null);
    setSummaryOpen(false);
    show(base);
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

  /** Downloads the checked items, or with nothing checked the whole room, as one zip; a lone file downloads as itself. */
  const downloadSelected = async () => {
    if (download) return;
    const everything = !checked.size || allChecked;
    const items = everything ? rootRefs : checkedRefs;
    if (!items.length) return;
    if (items.length === 1 && items[0].kind === "file") {
      window.location.assign(`/api/data-rooms/${roomId}/files/${items[0].id}?download=1`);
      return;
    }
    if (everything) selectAll();
    const bytes = everything ? totalBytes : selectedBytes();
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
        roomId,
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
          postArchive(roomId, items);
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

  return (
    <div
      ref={containerRef}
      className={styles.app}
      data-view={openFile || summaryOpen ? "viewer" : "tree"}
      data-tab={onFiles ? undefined : "page"}
    >
      <SidebarDock>
        <section className={styles.side} aria-label="Files" data-docked={docked ? "" : undefined}>
          <div className={styles.toolbar}>
            <div className={styles.search}>
              <label className={styles.searchField}>
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
                  <Menu
                    label="Add files or folder"
                    items={[
                      { id: "upload", label: "Upload files", onSelect: () => fileInputRef.current?.click() },
                      { id: "folder", label: "New folder", onSelect: newFolder },
                    ]}
                  >
                    <Icon name="plus" />
                  </Menu>
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

          <UploadList uploads={uploads} />

          {notice ? (
            <p className={styles.notice} role="alert">
              {notice}
              <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
                <Icon name="close" />
              </button>
            </p>
          ) : null}

          <div className={styles.footer}>
            {download ? (
              <>
                <span className={styles.count} role="status">
                  {download === "preparing"
                    ? "Preparing download…"
                    : `Downloading ${download.files.toLocaleString()} of ${download.totalFiles.toLocaleString()} files · ` +
                      `${formatBytes(download.bytes)} of ${formatBytes(download.totalBytes)}`}
                </span>
                <button type="button" className={ui.button} onClick={() => downloadAbort.current?.abort()}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span className={styles.count}>
                  {checked.size && !allChecked
                    ? `${checked.size} selected · ${formatBytes(selectedBytes())}`
                    : `${allChecked ? "All " : ""}${tree.files.length.toLocaleString()} files · ${formatBytes(totalBytes)}`}
                </span>
                {allChecked || !rootRefs.length ? null : (
                  <button type="button" className={styles.linkButton} onClick={selectAll}>
                    Select all
                  </button>
                )}
                {checked.size ? (
                  <button type="button" className={styles.linkButton} onClick={() => setChecked(new Set())}>
                    Clear
                  </button>
                ) : null}
                {isAdmin && checked.size ? (
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
                <button
                  type="button"
                  className={ui.primary}
                  onClick={downloadSelected}
                  disabled={!rootRefs.length}
                >
                  <Icon name="download" />
                  {checked.size && !allChecked ? "Download" : "Download all"}
                </button>
              </>
            )}
          </div>
        </section>
      </SidebarDock>

      {docked || !onFiles ? null : (
        <Splitter
          containerRef={containerRef}
          storageKey="zode:data-room:tree-share"
          label="Resize file list"
          cssVar="--tree-width"
          defaultFraction={0.33}
        />
      )}

      <Activity mode={onFiles ? "visible" : "hidden"}>
        <section className={styles.main} aria-label="Viewer">
          {summary && summaryOpen ? (
            <SummaryPanel summary={summary} onBack={closeViewer} onOpenFile={openById} />
          ) : (
            <Viewer key={openFile?.id ?? "none"} roomId={roomId} file={openFile} onBack={closeViewer} />
          )}
        </section>
      </Activity>

      <Activity mode={onFiles ? "hidden" : "visible"}>{children}</Activity>

      {dialog ? <Dialog {...dialog} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
