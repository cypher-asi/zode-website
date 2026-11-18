"use client";

import { useRef, useState, type ReactElement } from "react";
import { formatBytes } from "./fileKinds";
import { Icon } from "./icons";
import { MAX_ARCHIVE_BYTES } from "./types";
import { downloadRoomZip, zipPartName, type ZipPart, type ZipProgress } from "./zipDownload";
import browser from "./RoomBrowser.module.css";

/** A download too big for one zip, as the zips `planZipParts` split it into. */
export interface PartsRequest {
  roomName: string;
  /** Where each part's files are exchanged for signed file URLs. */
  manifestUrl: string;
  parts: ZipPart[];
}

type PartState =
  | { status: "idle" | "preparing" | "saved" }
  | { status: "saving"; progress: ZipProgress }
  | { status: "failed"; message: string };

export interface PartDownloadsControl {
  /** The open request and where each of its parts stands, or `null` when no split download is open. */
  state: { request: PartsRequest; parts: PartState[] } | null;
  /** Whether a part is being saved. */
  busy: boolean;
  /** Shows the request's parts and starts saving the first, replacing any request already open. */
  open: (request: PartsRequest) => void;
  start: (part: number) => void;
  cancel: (part: number) => void;
  /** Cancels the parts being saved and puts the request away. */
  close: () => void;
}

/**
 * A download split into zips, each saved on its own click, since a browser
 * only opens a save dialog or starts a download for one; they run side by
 * side, and one that fails is saved again without the others.
 */
export function usePartDownloads(): PartDownloadsControl {
  const [state, setState] = useState<PartDownloadsControl["state"]>(null);
  /** The open request and the parts of it being saved; what a replaced request's parts report is dropped. */
  const live = useRef<{ request: PartsRequest; aborts: Map<number, AbortController> } | null>(null);

  const setPart = (request: PartsRequest, part: number, next: PartState) =>
    setState((current) =>
      current?.request === request ? { request, parts: current.parts.map((was, i) => (i === part ? next : was)) } : current,
    );

  const startPart = async (request: PartsRequest, part: number) => {
    const run = live.current;
    if (run?.request !== request || run.aborts.has(part)) return;
    const controller = new AbortController();
    run.aborts.set(part, controller);
    setPart(request, part, { status: "preparing" });
    let end: PartState = { status: "idle" };
    try {
      const result = await downloadRoomZip({
        manifestUrl: request.manifestUrl,
        roomName: request.roomName,
        fileName: zipPartName(request.roomName, part + 1, request.parts.length),
        selection: { files: request.parts[part].fileIds, folders: [] },
        signal: controller.signal,
        onProgress: (progress) => {
          if (run.aborts.get(part) === controller) setPart(request, part, { status: "saving", progress });
        },
      });
      if (result === "done") end = { status: "saved" };
      else if (result === "unsupported") {
        end = {
          status: "failed",
          message:
            `This browser can only zip up to ${formatBytes(MAX_ARCHIVE_BYTES)} at a time. ` +
            "Use Chrome or Edge to download it, or download fewer folders at a time.",
        };
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        end = { status: "failed", message: error instanceof Error && error.message ? error.message : "The download failed. Try again." };
      }
    }
    run.aborts.delete(part);
    setPart(request, part, end);
  };

  const close = () => {
    for (const controller of live.current?.aborts.values() ?? []) controller.abort();
    live.current = null;
    setState(null);
  };

  return {
    state,
    busy: Boolean(state?.parts.some((part) => part.status === "preparing" || part.status === "saving")),
    open: (request) => {
      close();
      live.current = { request, aborts: new Map() };
      setState({ request, parts: request.parts.map(() => ({ status: "idle" })) });
      void startPart(request, 0);
    },
    start: (part) => {
      if (live.current) void startPart(live.current.request, part);
    },
    cancel: (part) => live.current?.aborts.get(part)?.abort(),
    close,
  };
}

/** The open split download, under the toolbar: why it's split, then a button per part. */
export function PartDownloads({ downloads }: { downloads: PartDownloadsControl }): ReactElement | null {
  if (!downloads.state) return null;
  const { request, parts } = downloads.state;
  const totalBytes = request.parts.reduce((sum, part) => sum + part.bytes, 0);

  return (
    <div className={browser.parts} role="group" aria-label="Download in parts">
      <p className={browser.partsNote}>
        This download is {formatBytes(totalBytes)}. Zips over 4 GB don&apos;t open everywhere, so it comes as{" "}
        {parts.length}: save each one, and they can download at the same time.
      </p>
      <div className={browser.partList}>
        {parts.map((part, i) => {
          const name = `Part ${i + 1}`;
          if (part.status === "preparing" || part.status === "saving") {
            const progress =
              part.status === "saving"
                ? `${part.progress.files.toLocaleString()} of ${part.progress.totalFiles.toLocaleString()}`
                : "Preparing…";
            return (
              <button
                key={i}
                type="button"
                className={browser.part}
                onClick={() => downloads.cancel(i)}
                aria-label={`Cancel part ${i + 1}, ${progress}`}
                title={
                  part.status === "saving"
                    ? `${formatBytes(part.progress.bytes)} of ${formatBytes(part.progress.totalBytes)}. Cancel`
                    : "Cancel"
                }
              >
                {name} · {progress}
                <Icon name="close" />
              </button>
            );
          }
          return (
            <button key={i} type="button" className={browser.part} onClick={() => downloads.start(i)}>
              <Icon name={part.status === "saved" ? "check" : "download"} />
              {name} ·{" "}
              {part.status === "saved" ? "Saved" : part.status === "failed" ? "Try again" : formatBytes(request.parts[i].bytes)}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className={browser.partsClose}
        onClick={downloads.close}
        aria-label={downloads.busy ? "Cancel the downloads and close" : "Close"}
      >
        <Icon name="close" />
      </button>
      {parts.map((part, i) =>
        part.status === "failed" ? (
          <p key={i} className={browser.partsError} role="alert">
            Part {i + 1}: {part.message}
          </p>
        ) : null,
      )}
    </div>
  );
}
