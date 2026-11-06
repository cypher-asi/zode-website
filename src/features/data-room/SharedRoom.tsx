"use client";

import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { copyText } from "@/features/profile/ProfileClient";
import { formatBytes } from "./fileKinds";
import { Icon } from "./icons";
import { checkedBytes, refsOf, RoomBrowser, useStoredView, ViewMenu } from "./RoomBrowser";
import browser from "./RoomBrowser.module.css";
import { useShareVisit } from "./shareTracker";
import { indexTree } from "./tree";
import { MAX_ARCHIVE_BYTES, sharedFilePath, sharedRoomPath, type RoomTree } from "./types";
import { FilePreview, SummaryPanel, type RoomSummary } from "./Viewer";
import viewer from "./Viewer.module.css";
import { downloadRoomZip, postRoomArchive, type ZipProgress, type ZipSelection } from "./zipDownload";
import styles from "./SharedRoom.module.css";
import ui from "./ui.module.css";

const VIEW_KEY = "zode:shared-room:view";

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
  const index = useMemo(() => indexTree(tree), [tree]);
  const requestedFolder = searchParams.get("folder");
  const folderId = requestedFolder && index.folders.has(requestedFolder) ? requestedFolder : null;
  const openFile = tree.files.find((file) => file.id === searchParams.get("file")) ?? null;
  const summaryOpen = Boolean(summary) && !openFile && searchParams.get("summary") === "1";
  useShareVisit(token, openFile?.id ?? null);

  const [query, setQuery] = useState("");
  const [view, setView] = useStoredView(VIEW_KEY, "details");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [download, setDownload] = useState<ZipProgress | "preparing" | null>(null);
  const downloadAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const go = (next: { folder?: string | null; file?: string | null; summary?: boolean }) => {
    setChecked(new Set());
    setQuery("");
    const folder = next.folder === undefined ? folderId : next.folder;
    const params = new URLSearchParams();
    if (folder) params.set("folder", folder);
    if (next.file) params.set("file", next.file);
    if (next.summary) params.set("summary", "1");
    const search = params.toString();
    router.push(search ? `${pathname}?${search}` : pathname, { scroll: false });
  };

  const someSelected = checked.size > 0;

  const downloadSelected = async () => {
    if (download || !tree.files.length) return;
    const everything = !someSelected;
    const rootItems = [
      ...(index.childFolders.get(null) ?? []).map((folder) => ({ kind: "folder" as const, id: folder.id })),
      ...(index.childFiles.get(null) ?? []).map((file) => ({ kind: "file" as const, id: file.id })),
    ];
    const items = everything ? rootItems : refsOf(checked);
    if (!items.length) return;
    if (items.length === 1 && items[0].kind === "file") {
      window.location.assign(`${sharedFilePath(token, items[0].id)}?download=1`);
      return;
    }
    const bytes = everything ? tree.files.reduce((sum, file) => sum + file.sizeBytes, 0) : checkedBytes(tree, index, checked);
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

  const closePreview = () => {
    const parent = openFile?.folderId && index.folders.has(openFile.folderId) ? openFile.folderId : folderId;
    go({ folder: parent });
  };

  return (
    <div className={styles.page} data-theme="dark">
      <header className={browser.toolbar}>
        <a className={styles.mark} href={osHref} aria-label="Open in ZODE">
          {/* The wordmark is white; this page is always the dark browser. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/wordmark.png" alt="" />
        </a>
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
            }}
          />
        </label>
        <div className={browser.tools}>
          {download ? (
            <>
              <span className={browser.progress} role="status">
                {download === "preparing"
                  ? "Preparing…"
                  : `${download.files.toLocaleString()} of ${download.totalFiles.toLocaleString()}`}
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
              disabled={!tree.files.length}
              aria-label={someSelected ? "Download selected" : "Download all"}
            >
              <Icon name="download" />
              <span className={browser.toolLabel}>{someSelected ? "Download" : "Download all"}</span>
            </button>
          )}
          <button type="button" className={browser.tool} onClick={copyLink} aria-label={copied ? "Link copied" : "Copy link"}>
            <Icon name={copied ? "check" : "link"} />
            <span className={browser.toolLabel}>{copied ? "Copied" : "Copy link"}</span>
          </button>
          <ViewMenu view={view} onChange={setView} />
        </div>
      </header>

      {notice ? (
        <p className={browser.notice} role="alert">
          {notice}
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
            <Icon name="close" />
          </button>
        </p>
      ) : null}

      {openFile ? (
        <div className={browser.preview}>
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
        <div className={browser.preview}>
          <SummaryPanel summary={summary} showBack onBack={() => go({ folder: null })} onOpenFile={(fileId) => go({ file: fileId })} />
        </div>
      ) : (
        <RoomBrowser
          tree={tree}
          index={index}
          rootName={roomName}
          rootCrumb="Data room"
          folderId={folderId}
          query={query}
          view={view}
          hasSummary={Boolean(summary)}
          checked={checked}
          onCheckedChange={setChecked}
          thumbUrl={(fileId) => `${sharedFilePath(token, fileId)}?thumb=1`}
          onOpenFolder={(id) => go({ folder: id })}
          onOpenFile={(file) => go({ folder: file.folderId && index.folders.has(file.folderId) ? file.folderId : null, file: file.id })}
          onOpenSummary={() => go({ folder: null, summary: true })}
        />
      )}
    </div>
  );
}
