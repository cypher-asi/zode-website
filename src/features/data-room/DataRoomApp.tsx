"use client";

import { Activity, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SidebarDock, useDocked } from "@/features/portal/PortalFrame";
import {
  createFolderAction,
  deleteItemsAction,
  markRoomOpenedAction,
  moveItemsAction,
  renameItemAction,
  type ItemRef,
} from "./actions";
import { Dialog, type DialogProps } from "./Dialog";
import { formatBytes } from "./fileKinds";
import { FolderTree } from "./FolderTree";
import { Icon } from "./icons";
import { checkedBytes, refsOf, RoomBrowser, ToolMenu, useStoredView, ViewMenu } from "./RoomBrowser";
import browser from "./RoomBrowser.module.css";
import { ancestorsOf, folderPath, indexTree, summaryKey, type TreeAction, type TreeIndex } from "./tree";
import { MAX_ARCHIVE_BYTES, type RoomFile, type RoomTree } from "./types";
import { UploadList } from "./UploadList";
import { useUploads } from "./useUploads";
import { FilePreview, SummaryPanel, type RoomSummaries } from "./Viewer";
import { downloadRoomZip, postRoomArchive, type ZipProgress, type ZipSelection } from "./zipDownload";
import styles from "./DataRoomApp.module.css";

const VIEW_KEY = "zode:data-room:view";

interface DataRoomAppProps {
  roomId: string;
  roomName: string;
  isAdmin: boolean;
  tree: RoomTree;
  summaries: RoomSummaries;
  /** The room's Banking Info, pinned at the top level when it has one. */
  banking: ReactNode | null;
  /** The open tab's page; every tab but Files shows it in the browser's place. */
  children: ReactNode;
}

/** Where the Files tab is: a folder, and maybe a file, the summary or Banking Info open over it. */
interface Place {
  folderId: string | null;
  fileId: string | null;
  summary: boolean;
  banking: boolean;
}

const placeHref = (base: string, place: Place): string => {
  const params = new URLSearchParams();
  if (place.folderId) params.set("folder", place.folderId);
  if (place.fileId) params.set("file", place.fileId);
  if (place.summary) params.set("summary", "1");
  if (place.banking) params.set("banking", "1");
  const search = params.toString();
  return search ? `${base}?${search}` : base;
};

/** The place `params` name; a file alone opens over its own folder. */
function placeOf(params: URLSearchParams, index: TreeIndex, files: Map<string, RoomFile>): Place {
  const file = files.get(params.get("file") ?? "");
  const folder = params.get("folder") ?? file?.folderId ?? null;
  const summary = !file && params.get("summary") === "1";
  return {
    folderId: folder && index.folders.has(folder) ? folder : null,
    fileId: file?.id ?? null,
    summary,
    banking: !file && !summary && params.get("banking") === "1",
  };
}

const AT_ROOT: Place = { folderId: null, fileId: null, summary: false, banking: false };

/**
 * The data room itself, as the public link shows it: a toolbar over the open
 * folder's files and folders, in Explorer's views, with a file, the summary or
 * Banking Info opening in their place. The place rides in the address (`?folder=`,
 * `?file=`, `?summary=1`, `?banking=1`) so Back steps out again; the other tabs show their
 * page instead, and the place is kept for coming back to Files. Admins upload,
 * add folders, and rename, move or delete from here.
 */
export function DataRoomApp({
  roomId,
  roomName,
  isAdmin,
  tree,
  summaries,
  banking,
  children,
}: DataRoomAppProps): ReactElement {
  const index = useMemo(() => indexTree(tree), [tree]);
  const filesById = useMemo(() => new Map(tree.files.map((file) => [file.id, file])), [tree]);

  const base = `/portal/data-rooms/${roomId}`;
  const router = useRouter();
  const onFiles = usePathname() === base;
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  const [place, setPlace] = useState<Place>(() =>
    onFiles ? placeOf(searchParams, index, filesById) : AT_ROOT,
  );
  const [checkedRaw, setChecked] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [view, setView] = useStoredView(VIEW_KEY, "icons-md");
  const [dialog, setDialog] = useState<Omit<DialogProps, "onClose"> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** The zip being saved: `preparing` until its first bytes arrive. */
  const [download, setDownload] = useState<ZipProgress | "preparing" | null>(null);
  const downloadAbort = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** The folder the file picker uploads into once files are chosen. */
  const uploadTarget = useRef<string | null>(null);
  const uploads = useUploads(roomId);
  const docked = useDocked();

  useEffect(() => {
    void markRoomOpenedAction(roomId);
  }, [roomId]);

  // Follow the address on Files, e.g. Back or Activity's "Open". Coming back
  // from another tab by its bare link keeps the place you left.
  const [seen, setSeen] = useState({ onFiles, search });
  if (seen.onFiles !== onFiles || seen.search !== search) {
    const returning = onFiles && !seen.onFiles && search === "";
    setSeen({ onFiles, search });
    if (onFiles && !returning) {
      setPlace(placeOf(searchParams, index, filesById));
      setChecked(new Set());
    }
  }

  // Back on Files, the address names the place again.
  useEffect(() => {
    if (onFiles && search === "") {
      const href = placeHref(base, place);
      if (href !== base) window.history.replaceState(null, "", href);
    }
  }, [onFiles, search, base, place]);

  const folderId = place.folderId && index.folders.has(place.folderId) ? place.folderId : null;
  const openFile = place.fileId ? (filesById.get(place.fileId) ?? null) : null;
  const summary = summaries[summaryKey(folderId)] ?? null;
  const summaryOpen = Boolean(summary) && !openFile && place.summary;
  const bankingOpen = Boolean(banking) && folderId === null && !openFile && place.banking;
  const summaryFolders = useMemo(() => new Set(Object.keys(summaries)), [summaries]);

  // Drop selections whose items were deleted or moved out from under us.
  const checked = useMemo(
    () =>
      new Set(
        [...checkedRaw].filter((key) => (key.startsWith("d:") ? index.folders.has(key.slice(2)) : filesById.has(key.slice(2)))),
      ),
    [checkedRaw, index, filesById],
  );
  const checkedRefs = refsOf(checked);

  const totalBytes = useMemo(() => tree.files.reduce((sum, file) => sum + file.sizeBytes, 0), [tree]);

  /** The top-level folders and files; downloading them is downloading everything. */
  const rootRefs = useMemo<ItemRef[]>(
    () => [
      ...(index.childFolders.get(null) ?? []).map((folder) => ({ kind: "folder" as const, id: folder.id })),
      ...(index.childFiles.get(null) ?? []).map((file) => ({ kind: "file" as const, id: file.id })),
    ],
    [index],
  );

  /** Goes to `next`, a step Back can undo; from another tab, back to Files. */
  const go = (next: Place, { keepQuery = false } = {}) => {
    setPlace(next);
    setChecked(new Set());
    if (!keepQuery) setQuery("");
    const href = placeHref(base, next);
    if (onFiles) window.history.pushState(null, "", href);
    else router.push(href);
  };

  const openFolder = (id: string | null) => go({ ...AT_ROOT, folderId: id });

  const open = (file: RoomFile) => go({ ...AT_ROOT, folderId: file.folderId, fileId: file.id });

  const openSummary = (id: string | null) => go({ ...AT_ROOT, folderId: id, summary: true });

  const openBanking = () => go({ ...AT_ROOT, banking: true });

  const openById = (fileId: string) => {
    const file = filesById.get(fileId);
    if (file) open(file);
  };

  const closePreview = () => openFolder(openFile?.folderId && index.folders.has(openFile.folderId) ? openFile.folderId : folderId);

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
    if (action === "upload" && single?.kind === "folder") {
      pickFiles(single.id);
    } else if (action === "rename" && single) {
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
          if (!result.error) setChecked(new Set());
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
          if (!result.error) setChecked(new Set());
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
      onConfirm: async (name) => (await createFolderAction(roomId, folderId, name)).error,
    });

  const startUpload = (files: File[], target: string | null) => {
    if (files.length) uploads.start(files, target);
  };

  const pickFiles = (target: string | null) => {
    uploadTarget.current = target;
    fileInputRef.current?.click();
  };

  const move = async (items: ItemRef[], target: string | null) => {
    const result = await moveItemsAction(roomId, items, target);
    if (result.error) setNotice(result.error);
    else setChecked(new Set());
  };

  /** Downloads the checked items, or with nothing checked the whole room, as one zip; a lone file downloads as itself. */
  const downloadSelected = async () => {
    if (download) return;
    const everything = !checked.size;
    const items = everything ? rootRefs : checkedRefs;
    if (!items.length) return;
    if (items.length === 1 && items[0].kind === "file") {
      window.location.assign(`/api/data-rooms/${roomId}/files/${items[0].id}?download=1`);
      return;
    }
    const bytes = everything ? totalBytes : checkedBytes(tree, index, checked);
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
        manifestUrl: `/api/data-rooms/${roomId}/manifest`,
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
          postRoomArchive(`/api/data-rooms/${roomId}/archive`, items);
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

  const fileUrl = (fileId: string) => `/api/data-rooms/${roomId}/files/${fileId}`;

  const rootName = "Root";
  const rootCrumb = `${tree.files.length.toLocaleString()} ${tree.files.length === 1 ? "file" : "files"} · ${formatBytes(totalBytes)}`;

  const toolbar = (trail: ReactNode, back: ReactNode) => (
    <>
      <div className={browser.toolbar}>
        {back}
        {trail}
        <div className={browser.tools}>
          <label className={browser.search}>
            <Icon name="search" />
            <input
              type="search"
              value={query}
              placeholder="Search"
              aria-label="Search files"
              onChange={(event) => {
                setQuery(event.target.value);
                setChecked(new Set());
                if (openFile || summaryOpen || bankingOpen) go({ ...AT_ROOT, folderId }, { keepQuery: true });
              }}
            />
          </label>
          {isAdmin ? (
            <>
              <ToolMenu
                label="Add"
                items={[
                  { id: "upload", label: "Upload files", onSelect: () => pickFiles(folderId) },
                  { id: "folder", label: "New folder", onSelect: newFolder },
                ]}
              >
                <Icon name="plus" />
                <span className={browser.toolLabel}>Add</span>
              </ToolMenu>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={(event) => {
                  startUpload([...(event.target.files ?? [])], uploadTarget.current);
                  event.target.value = "";
                }}
              />
            </>
          ) : null}
          {download ? (
            <>
              <span className={browser.progress} role="status">
                {download === "preparing"
                  ? "Preparing…"
                  : `${download.files.toLocaleString()} of ${download.totalFiles.toLocaleString()} · ` +
                    `${formatBytes(download.bytes)} of ${formatBytes(download.totalBytes)}`}
              </span>
              <button type="button" className={browser.tool} onClick={() => downloadAbort.current?.abort()}>
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              className={browser.tool}
              onClick={downloadSelected}
              disabled={!rootRefs.length}
              aria-label={checked.size ? "Download selected" : "Download all"}
            >
              <Icon name="download" />
              <span className={browser.toolLabel}>{checked.size ? "Download" : "Download all"}</span>
            </button>
          )}
          <ViewMenu view={view} onChange={setView} />
        </div>
      </div>

      {notice ? (
        <p className={browser.notice} role="alert">
          {notice}
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
            <Icon name="close" />
          </button>
        </p>
      ) : null}

      {checked.size && !openFile && !summaryOpen && !bankingOpen ? (
        <div className={styles.selection}>
          <span className={styles.count}>
            {checked.size.toLocaleString()} selected · {formatBytes(checkedBytes(tree, index, checked))}
          </span>
          {isAdmin ? (
            <>
              <button type="button" className={styles.linkButton} onClick={() => runAction("move", checkedRefs)}>
                Move
              </button>
              <button type="button" className={styles.linkButton} data-danger="" onClick={() => runAction("delete", checkedRefs)}>
                Delete
              </button>
            </>
          ) : null}
          <button type="button" className={styles.linkButton} onClick={() => setChecked(new Set())}>
            Clear
          </button>
        </div>
      ) : null}
    </>
  );

  return (
    <div className={styles.app} data-tab={onFiles ? undefined : "page"}>
      {docked ? (
        <SidebarDock>
          <div className={styles.explorer}>
            <FolderTree
              index={index}
              rootName={rootName}
              folderId={openFile?.folderId && index.folders.has(openFile.folderId) ? openFile.folderId : folderId}
              openFileId={onFiles ? (openFile?.id ?? null) : null}
              summaries={
                summaryFolders.size
                  ? {
                      folders: summaryFolders,
                      links: (key) => summaries[key]?.links ?? [],
                      open: onFiles && summaryOpen,
                      onOpen: openSummary,
                    }
                  : null
              }
              banking={banking ? { open: onFiles && bankingOpen, onOpen: openBanking } : null}
              onOpenFolder={openFolder}
              onOpenFile={open}
              admin={isAdmin ? { onAction: runAction, onDropFiles: startUpload, onMove: move } : undefined}
            />
            <p className={styles.total}>{rootCrumb}</p>
          </div>
        </SidebarDock>
      ) : null}
      <Activity mode={onFiles ? "visible" : "hidden"}>
        <section className={styles.files} aria-label="Files">
          <RoomBrowser
            tree={tree}
            index={index}
            rootName={rootName}
            rootCrumb={docked ? null : rootCrumb}
            titleAs="h2"
            folderId={folderId}
            query={query}
            view={view}
            hasSummary={Boolean(summary)}
            links={summary?.links}
            hasBanking={Boolean(banking) && folderId === null}
            onOpenBanking={openBanking}
            checked={checked}
            onCheckedChange={setChecked}
            thumbUrl={(fileId) => `${fileUrl(fileId)}?thumb=1`}
            onOpenFolder={openFolder}
            onOpenFile={open}
            onOpenSummary={() => openSummary(folderId)}
            admin={
              isAdmin
                ? { onAction: runAction, onDropFiles: startUpload, onMove: move }
                : undefined
            }
            toolbar={toolbar}
            open={
              openFile
                ? {
                    name: openFile.name,
                    folderId: openFile.folderId && index.folders.has(openFile.folderId) ? openFile.folderId : null,
                    content: <FilePreview key={openFile.id} url={fileUrl(openFile.id)} file={openFile} />,
                    onClose: closePreview,
                  }
                : summary && summaryOpen
                  ? {
                      name: "Summary",
                      folderId,
                      onClose: () => openFolder(folderId),
                      content: (
                        <SummaryPanel
                          key={summaryKey(folderId)}
                          summary={summary}
                          onOpenFile={openById}
                          onOpenFolder={(id, withSummary) => go({ ...AT_ROOT, folderId: id, summary: withSummary })}
                        />
                      ),
                    }
                  : bankingOpen
                    ? {
                        name: "Banking Info",
                        folderId: null,
                        onClose: () => openFolder(null),
                        content: <SummaryPanel summary={{ content: banking }} onOpenFile={openById} onOpenFolder={openFolder} />,
                      }
                    : undefined
            }
          />

          <UploadList uploads={uploads} />
        </section>
      </Activity>

      <Activity mode={onFiles ? "hidden" : "visible"}>{children}</Activity>

      {dialog ? <Dialog {...dialog} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
