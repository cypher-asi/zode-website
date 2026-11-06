import { useCallback, useSyncExternalStore } from "react";
import type { SheetGrid } from "./sheetGrid";
import type { SheetWorkerMessage, SheetWorkerRequest } from "./sheet.worker";
import { fetchFile } from "./types";

/**
 * Workbooks read for the sheet viewer, kept for the session so going back to
 * one shows it at once, on the sheet and scroll position it was left at. A
 * load carries on when its viewer closes, so reopening picks it up. Reopening
 * a loaded workbook revalidates it in the background, which the server audits
 * as a view and which shows the file as gone if access was revoked.
 */

const MAX_BOOKS = 5;
const UNREADABLE = "This workbook couldn't be previewed. Download it to open it in Excel.";
const GONE = "This file is no longer available to you.";

export interface Book {
  names: string[];
  grids: (SheetGrid | null)[];
  failed: boolean[];
}

export interface WorkbookState {
  book: Book | null;
  error: string | null;
  /** The sheet tab on screen. */
  active: number;
}

interface Entry {
  url: string;
  id: number;
  state: WorkbookState;
  listeners: Set<() => void>;
  controller: AbortController;
  /** Every sheet has arrived or failed. */
  loaded: boolean;
  /** Each sheet's scroll position at 100%, kept off `state` so scrolling doesn't re-render. */
  scroll: Map<number, { top: number; left: number }>;
}

const LOADING: WorkbookState = { book: null, error: null, active: 0 };

/** In order of use, least recent first. */
const entries = new Map<string, Entry>();

let worker: Worker | null = null;
let nextId = 0;
const handlers = new Map<number, (message: SheetWorkerMessage) => void>();

/** One worker for every workbook, started on first use and replaced if it crashes. */
function sheetWorker(): Worker {
  if (worker) return worker;
  const started = new Worker(new URL("./sheet.worker.ts", import.meta.url), { type: "module" });
  const crash = () => {
    if (worker === started) worker = null;
    started.terminate();
    for (const [id, handle] of [...handlers]) handle({ id, type: "error" });
  };
  started.onmessage = ({ data }: MessageEvent<SheetWorkerMessage>) => handlers.get(data.id)?.(data);
  started.onerror = crash;
  started.onmessageerror = crash;
  worker = started;
  return started;
}

function update(entry: Entry, patch: Partial<WorkbookState>): void {
  entry.state = { ...entry.state, ...patch };
  for (const listener of entry.listeners) listener();
}

function evict(entry: Entry): void {
  if (entries.get(entry.url) === entry) entries.delete(entry.url);
  entry.controller.abort();
  handlers.delete(entry.id);
}

function load(url: string): Entry {
  const entry: Entry = {
    url,
    id: nextId++,
    state: LOADING,
    listeners: new Set(),
    controller: new AbortController(),
    loaded: false,
    scroll: new Map(),
  };
  const fail = (error: string) => {
    handlers.delete(entry.id);
    update(entry, { error });
  };
  handlers.set(entry.id, (data) => {
    const book = entry.state.book;
    if (data.type === "workbook") {
      update(entry, {
        active: data.active,
        book: { names: data.sheets, grids: data.sheets.map(() => null), failed: data.sheets.map(() => false) },
      });
    } else if (data.type === "sheet") {
      if (book) update(entry, { book: { ...book, grids: book.grids.map((grid, i) => (i === data.index ? data.grid : grid)) } });
    } else if (data.index === undefined) {
      fail(UNREADABLE);
      return;
    } else if (book) {
      update(entry, { book: { ...book, failed: book.failed.map((failed, i) => failed || i === data.index) } });
    }
    const done = entry.state.book;
    if (done && done.grids.every((grid, i) => grid || done.failed[i])) {
      entry.loaded = true;
      handlers.delete(entry.id);
    }
  });
  fetchFile(url, entry.controller.signal).then(
    (buffer) => {
      if (!handlers.has(entry.id)) return;
      const request: SheetWorkerRequest = { id: entry.id, buffer };
      sheetWorker().postMessage(request, [buffer]);
    },
    (err: unknown) => {
      if (entry.controller.signal.aborted) return;
      fail(err instanceof Error && err.message.includes("no longer available") ? err.message : UNREADABLE);
    },
  );
  return entry;
}

function revalidate(entry: Entry): void {
  fetch(entry.url, { cache: "no-cache" }).then(
    (res) => {
      void res.body?.cancel();
      if (res.status === 404) update(entry, { error: GONE });
    },
    () => {},
  );
}

/** The workbook at `url`, loading it unless it's kept, and marking it most recently used. */
function acquire(url: string): Entry {
  let entry = entries.get(url);
  if (entry?.state.error) {
    evict(entry);
    entry = undefined;
  }
  if (entry) {
    entries.delete(url);
    entries.set(url, entry);
    if (entry.loaded && !entry.listeners.size) revalidate(entry);
    return entry;
  }
  const loaded = load(url);
  entries.set(url, loaded);
  for (const old of entries.values()) {
    if (entries.size <= MAX_BOOKS) break;
    if (old !== loaded && !old.listeners.size) evict(old);
  }
  return loaded;
}

const noServerState = () => LOADING;

/** The workbook at `url` as it loads, from the session's cache when it was opened before. */
export function useWorkbook(url: string): WorkbookState {
  const subscribe = useCallback(
    (listener: () => void) => {
      const entry = acquire(url);
      entry.listeners.add(listener);
      return () => {
        entry.listeners.delete(listener);
      };
    },
    [url],
  );
  const snapshot = useCallback(() => entries.get(url)?.state ?? LOADING, [url]);
  return useSyncExternalStore(subscribe, snapshot, noServerState);
}

export function selectSheet(url: string, index: number): void {
  const entry = entries.get(url);
  if (entry) update(entry, { active: index });
}

export function sheetScroll(url: string, index: number): { top: number; left: number } {
  return entries.get(url)?.scroll.get(index) ?? { top: 0, left: 0 };
}

export function rememberScroll(url: string, index: number, top: number, left: number): void {
  entries.get(url)?.scroll.set(index, { top, left });
}
