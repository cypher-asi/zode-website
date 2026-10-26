/*
 * Streams a data room zip as a download in browsers without a save dialog
 * (Safari, Firefox); see src/features/data-room/zipDownload.ts. The page posts
 * a job (the zip's name and each file's signed Blob URL) with a port for
 * progress, then navigates to /api/data-rooms/zip/<job id>, which this worker
 * answers with the zip as an attachment, fetching each file as it's reached.
 */
/* global downloadZip */
importScripts("/data-room-zip.js");

const RETRIES = 3;
/** Jobs the page never opened are dropped after this long. */
const JOB_TTL_MS = 60_000;

const jobs = new Map();

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
    jobs.get(data.id)?.abort.abort();
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
  event.respondWith(job ? zipResponse(job) : new Response(null, { status: 204 }));
});

function zipResponse({ manifest, port, abort }) {
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
          controller.close();
          port.postMessage({ type: "done" });
        } else {
          controller.enqueue(value);
        }
      } catch (error) {
        port.postMessage({ type: "error", message: error?.message || "The download failed." });
        controller.error(error);
      }
    },
    cancel(reason) {
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

/** One file's bytes; a dropped connection resumes from the last byte received, up to RETRIES times in a row. */
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
          if (signal.aborted || error.fatal || ++failures > RETRIES) throw error;
          await new Promise((resolve) => setTimeout(resolve, 1000 * failures));
        }
      }
    },
    cancel(reason) {
      return reader?.cancel(reason);
    },
  });
}
