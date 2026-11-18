/*
 * Streams a data room zip as a download in browsers without a save dialog
 * (Safari, Firefox); see src/features/data-room/zipDownload.ts. The page posts
 * a job (the zip's name and each file's signed Blob URL) with a port for
 * progress, then navigates to /api/data-rooms/zip/<job id>, which this worker
 * answers with the zip as an attachment, fetching each file as it's reached.
 */
/* global downloadZip */
importScripts("/data-room-zip.js");

/** As in zipDownload.ts: the wait before each retry in a row of a file's dropped connection or passing storage error. */
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 15000, 30000, 30000, 30000];
const PASSING_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
/** Jobs the page never opened are dropped after this long. */
const JOB_TTL_MS = 60_000;

const jobs = new Map();
/** The abort of each zip being streamed, by job id, so the page can still cancel one once its download has started. */
const running = new Map();

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data?.type === "job" && event.ports[0]) {
    const port = event.ports[0];
    jobs.set(data.id, { manifest: data.manifest, port, abort: new AbortController() });
    setTimeout(() => jobs.delete(data.id), JOB_TTL_MS);
    port.postMessage({ type: "ready" });
  } else if (data?.type === "cancel") {
    (jobs.get(data.id)?.abort ?? running.get(data.id))?.abort();
    jobs.delete(data.id);
  }
  // A "ping" needs no reply: each message keeps the worker running while a zip streams.
});

self.addEventListener("fetch", (event) => {
  const match = /\/api\/data-rooms\/zip\/([\w-]+)$/.exec(new URL(event.request.url).pathname);
  if (!match) return;
  const job = jobs.get(match[1]);
  jobs.delete(match[1]);
  // No content leaves the page where it is; the page reports that nothing started.
  event.respondWith(job ? zipResponse(match[1], job) : new Response(null, { status: 204 }));
});

function zipResponse(id, { manifest, port, abort }) {
  running.set(id, abort);
  port.postMessage({ type: "started" });
  let files = 0;
  let bytes = 0;
  let last = 0;
  const report = (count, fileDone) => {
    bytes += count;
    if (fileDone) files += 1;
    const now = Date.now();
    if (fileDone || now - last > 250) {
      last = now;
      port.postMessage({ type: "progress", files, bytes });
    }
  };

  function* entries() {
    for (const file of manifest.files) {
      yield {
        name: file.path,
        lastModified: new Date(file.lastModified),
        size: file.size,
        input: fileStream(file.url, abort.signal, report),
      };
    }
  }
  const zip = downloadZip(entries(), {
    metadata: manifest.files.map((file) => ({ name: file.path, size: file.size })),
  });

  const reader = zip.body.getReader();
  const body = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          running.delete(id);
          controller.close();
          port.postMessage({ type: "done" });
        } else {
          controller.enqueue(value);
        }
      } catch (error) {
        running.delete(id);
        port.postMessage({ type: "error", message: error?.message || "The download failed." });
        controller.error(error);
      }
    },
    cancel(reason) {
      running.delete(id);
      abort.abort();
      port.postMessage({ type: "error", message: "The download was cancelled." });
      return reader.cancel(reason);
    },
  });

  const fallback = manifest.name.replace(/[^\x20-\x7e]|["\\%]/g, "_");
  const headers = {
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(manifest.name)}`,
    "Cache-Control": "no-store",
  };
  const length = zip.headers.get("Content-Length");
  if (length) headers["Content-Length"] = length;
  return new Response(body, { headers });
}

/**
 * One file's bytes; a dropped connection, or storage answering with a passing
 * error, is retried after each of RETRY_DELAYS_MS in a row, resuming from the
 * last byte received.
 */
function fileStream(url, signal, report) {
  let received = 0;
  let failures = 0;
  let reader = null;

  const open = async () => {
    const res = await fetch(url, {
      signal,
      cache: "no-store",
      headers: received ? { Range: `bytes=${received}-` } : undefined,
    });
    if (received ? res.status !== 206 : !res.ok) {
      void res.body?.cancel().catch(() => {});
      if (PASSING_STATUSES.has(res.status)) {
        throw new Error(`File storage is unavailable (HTTP ${res.status}). Try again shortly.`);
      }
      const error = new Error(
        res.status === 403 ? "The download link expired. Start the download again." : `HTTP ${res.status}`,
      );
      error.fatal = true;
      throw error;
    }
    reader = res.body.getReader();
  };

  return new ReadableStream({
    async pull(controller) {
      for (;;) {
        try {
          if (!reader) await open();
          const { done, value } = await reader.read();
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
          if (signal.aborted || error.fatal || failures >= RETRY_DELAYS_MS.length) throw error;
          // Tells the page the zip is still alive, so it doesn't call a retry's wait a stall.
          report(0, false);
          await pause(RETRY_DELAYS_MS[failures++], signal);
        }
      }
    },
    cancel(reason) {
      return reader?.cancel(reason);
    },
  });
}

/** Waits ms, or until signal aborts, so a cancelled download isn't held to the end of a retry's wait. */
function pause(ms, signal) {
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
