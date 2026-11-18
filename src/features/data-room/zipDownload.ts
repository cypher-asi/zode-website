import { downloadZip } from "client-zip";
import { MAX_ZIP_PART_BYTES, type ZipManifest } from "./types";

export type ZipSelection = { all: true } | { files: string[]; folders: string[] };

export interface ZipProgress {
  files: number;
  totalFiles: number;
  bytes: number;
  totalBytes: number;
}

interface ZipDownloadOptions {
  /** Where the selection is exchanged for signed file URLs. */
  manifestUrl: string;
  roomName: string;
  /** The zip's name when it isn't the room's dated one, as for one part of a split download. */
  fileName?: string;
  selection: ZipSelection;
  signal: AbortSignal;
  onProgress: (progress: ZipProgress) => void;
}

/** One zip of a download split to keep every zip under `MAX_ZIP_PART_BYTES`. */
export interface ZipPart {
  fileIds: string[];
  /** The bytes of the files in it. */
  bytes: number;
}

/** What a zip spends on each file besides its bytes and its path, which it stores twice, and once at its end. */
const ZIP_ENTRY_BYTES = 92;
const ZIP_END_BYTES = 22;

/**
 * Splits `files` into the fewest zips that each stay under `maxBytes`, in path
 * order so a part holds whole folders where it can. Files a zip would have to
 * rename apart (the same path, as a file manager sees it) stay in one part; a
 * file too big for any part gets its own.
 */
export function planZipParts(
  files: { id: string; path: string; size: number }[],
  maxBytes: number = MAX_ZIP_PART_BYTES,
): ZipPart[] {
  const encoder = new TextEncoder();
  const sorted = files
    .map((file) => ({ ...file, key: file.path.toLowerCase() }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const parts: (ZipPart & { zipBytes: number })[] = [];
  let lastKey: string | null = null;
  for (const file of sorted) {
    const cost = file.size + 2 * encoder.encode(file.path).length + ZIP_ENTRY_BYTES;
    let part = parts[parts.length - 1];
    if (!part || (part.zipBytes + cost > maxBytes && file.key !== lastKey)) {
      part = { fileIds: [], bytes: 0, zipBytes: ZIP_END_BYTES };
      parts.push(part);
    }
    part.fileIds.push(file.id);
    part.bytes += file.size;
    part.zipBytes += cost;
    lastKey = file.key;
  }
  return parts.map(({ fileIds, bytes }) => ({ fileIds, bytes }));
}

/** The name one part of a split download saves as; short, since Windows counts it toward each extracted file's path. */
export const zipPartName = (roomName: string, part: number, parts: number): string =>
  `${roomName} ${part} of ${parts}.zip`;

/** `done` once the zip is saved; `cancelled` when the save dialog is dismissed; `unsupported` when the browser can't zip on its own. */
export type ZipResult = "done" | "cancelled" | "unsupported";

interface SaveFilePickerWindow {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{
    createWritable: () => Promise<WritableStream<Uint8Array>>;
    remove?: () => Promise<void>;
  }>;
}

const SW_URL = "/data-room-sw.js";
const SW_SCOPE = "/api/data-rooms/zip/";
/**
 * How long to wait before each retry of a file whose connection dropped or
 * whose storage answered with a passing error: about two minutes in a row,
 * enough to ride out a Wi-Fi change or a laptop waking, before the zip fails.
 */
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 15_000, 30_000, 30_000, 30_000];
/** Statuses storage answers with when it's busy or briefly down, rather than refusing the file. */
const PASSING_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

/** Posts the selection to a server zip route, for browsers that can't zip on their own. */
export function postRoomArchive(action: string, items: { kind: "file" | "folder"; id: string }[]): void {
  const form = document.createElement("form");
  form.method = "post";
  form.action = action;
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

/**
 * Zips a room's selection in the browser, each file fetched straight from Blob
 * with a signed URL, so there's no size or time limit. Browsers with a save
 * dialog (Chrome, Edge) stream the zip into the chosen file; others (Safari,
 * Firefox) have the data room's service worker stream it as a download.
 */
export async function downloadRoomZip(options: ZipDownloadOptions): Promise<ZipResult> {
  const picker = (window as SaveFilePickerWindow).showSaveFilePicker;
  if (picker) {
    // Opened first, while the click still counts as a user gesture.
    const handle = await picker({
      suggestedName: options.fileName ?? `${options.roomName} ${new Date().toISOString().slice(0, 10)}.zip`,
      types: [{ description: "Zip archive", accept: { "application/zip": [".zip"] } }],
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return null;
      throw error;
    });
    if (!handle) return "cancelled";
    try {
      const manifest = await fetchManifest(options.manifestUrl, options.selection, options.signal);
      const writable = await handle.createWritable();
      await zipStream(manifest, options.signal, progressReporter(manifest, options.onProgress)).pipeTo(writable, {
        signal: options.signal,
      });
      return "done";
    } catch (error) {
      await handle.remove?.().catch(() => {});
      throw error;
    }
  }

  const worker = await zipWorker();
  if (!worker) return "unsupported";
  const manifest = await fetchManifest(options.manifestUrl, options.selection, options.signal);
  await zipInWorker(worker, options.fileName ? { ...manifest, name: options.fileName } : manifest, options);
  return "done";
}

async function fetchManifest(manifestUrl: string, selection: ZipSelection, signal: AbortSignal): Promise<ZipManifest> {
  const res = await fetch(manifestUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(selection),
    signal,
  });
  if (!res.ok) {
    throw new Error(res.status === 404 ? "Those files are no longer in the room." : (await res.text()) || `HTTP ${res.status}`);
  }
  return (await res.json()) as ZipManifest;
}

function progressReporter(manifest: ZipManifest, onProgress: (progress: ZipProgress) => void) {
  const progress: ZipProgress = {
    files: 0,
    totalFiles: manifest.files.length,
    bytes: 0,
    totalBytes: manifest.files.reduce((sum, file) => sum + file.size, 0),
  };
  let last = 0;
  return (bytes: number, fileDone: boolean) => {
    progress.bytes += bytes;
    if (fileDone) progress.files += 1;
    const now = performance.now();
    if (fileDone || now - last > 250) {
      last = now;
      onProgress({ ...progress });
    }
  };
}

function zipStream(
  manifest: ZipManifest,
  signal: AbortSignal,
  report: (bytes: number, fileDone: boolean) => void,
): ReadableStream<Uint8Array> {
  function* entries() {
    for (const file of manifest.files) {
      yield {
        name: file.path,
        lastModified: new Date(file.lastModified),
        size: file.size,
        input: fileStream(file.url, signal, report),
      };
    }
  }
  const zip = downloadZip(entries(), { metadata: manifest.files.map((file) => ({ name: file.path, size: file.size })) });
  return zip.body!;
}

/**
 * One file's bytes, fetched when the zip reaches it. A dropped connection, or
 * storage answering with a passing error, is retried after each of
 * `RETRY_DELAYS_MS` in a row, resuming from the last byte received.
 */
function fileStream(
  url: string,
  signal: AbortSignal,
  report: (bytes: number, fileDone: boolean) => void,
): ReadableStream<Uint8Array> {
  let received = 0;
  let failures = 0;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  const open = async () => {
    const res = await fetch(url, {
      signal,
      cache: "no-store",
      headers: received ? { Range: `bytes=${received}-` } : undefined,
    });
    if (received ? res.status !== 206 : !res.ok) {
      void res.body?.cancel().catch(() => {});
      if (PASSING_STATUSES.has(res.status)) throw new Error(`File storage is unavailable (HTTP ${res.status}). Try again shortly.`);
      throw new HttpError(res.status === 403 ? "The download link expired. Start the download again." : `HTTP ${res.status}`);
    }
    reader = res.body!.getReader();
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      for (;;) {
        try {
          if (!reader) await open();
          const { done, value } = await reader!.read();
          if (done) {
            report(0, true);
            controller.close();
            return;
          }
          received += value.byteLength;
          failures = 0;
          report(value.byteLength, false);
          controller.enqueue(value);
          return;
        } catch (error) {
          reader = null;
          if (signal.aborted || error instanceof HttpError || failures >= RETRY_DELAYS_MS.length) throw error;
          await pause(RETRY_DELAYS_MS[failures++], signal);
        }
      }
    },
    cancel(reason) {
      return reader?.cancel(reason);
    },
  });
}

class HttpError extends Error {}

/** Waits `ms`, or until `signal` aborts, so a cancelled download isn't held to the end of a retry's wait. */
function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done);
  });
}

/** The data room's service worker, installed and running, or `null` where service workers aren't available. */
async function zipWorker(): Promise<ServiceWorker | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    // The CDN gives these scripts a long browser cache, so updates are checked past it.
    const registration = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE, updateViaCache: "none" });
    const worker = registration.installing ?? registration.waiting ?? registration.active;
    if (!worker) return null;
    if (worker.state === "activated") return worker;
    return await new Promise<ServiceWorker | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 10_000);
      worker.addEventListener("statechange", () => {
        if (worker.state === "activated") {
          clearTimeout(timer);
          resolve(worker);
        } else if (worker.state === "redundant") {
          clearTimeout(timer);
          resolve(registration.active);
        }
      });
    });
  } catch {
    return null;
  }
}

type WorkerMessage =
  | { type: "ready" }
  | { type: "started" }
  | { type: "progress"; files: number; bytes: number }
  | { type: "done" }
  | { type: "error"; message: string };

/**
 * Hands the manifest to the service worker, then navigates to its zip URL;
 * the worker answers with the zip as an attachment, so the page stays put and
 * the browser saves it. The page pings the worker so it isn't stopped mid-download.
 */
function zipInWorker(worker: ServiceWorker, manifest: ZipManifest, options: ZipDownloadOptions): Promise<void> {
  const id = crypto.randomUUID();
  const channel = new MessageChannel();
  const totalBytes = manifest.files.reduce((sum, file) => sum + file.size, 0);

  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const keepAlive = setInterval(() => worker.postMessage({ type: "ping" }), 10_000);
    const finish = (error?: Error) => {
      clearInterval(keepAlive);
      clearTimeout(timer);
      channel.port1.close();
      options.signal.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else resolve();
    };
    const waitFor = (ms: number, message: string) => {
      clearTimeout(timer);
      timer = setTimeout(() => finish(new Error(message)), ms);
    };
    const onAbort = () => {
      worker.postMessage({ type: "cancel", id });
      finish(new DOMException("Download cancelled", "AbortError"));
    };
    options.signal.addEventListener("abort", onAbort);

    channel.port1.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.type === "ready") {
        waitFor(20_000, "Your browser didn't start the download. Try again, or use Chrome or Edge.");
        const link = document.createElement("a");
        link.href = `${SW_SCOPE}${id}`;
        link.click();
      } else if (message.type === "started" || message.type === "progress") {
        waitFor(120_000, "The download stalled. Check your connection and try again.");
        if (message.type === "progress") {
          options.onProgress({ files: message.files, totalFiles: manifest.files.length, bytes: message.bytes, totalBytes });
        }
      } else if (message.type === "done") {
        finish();
      } else if (message.type === "error") {
        finish(new Error(message.message));
      }
    };
    waitFor(10_000, "Your browser couldn't prepare the download. Try again, or use Chrome or Edge.");
    worker.postMessage({ type: "job", id, manifest }, [channel.port2]);
  });
}
