import "server-only";
import { downloadZip } from "client-zip";
import type { NextRequest } from "next/server";
import type { Account } from "@/features/account/zos";
import { recordEvent, recordEvents, type AuditActor } from "./audit";
import { presignedDownloadUrl, presignedDownloadUrls, readBlob } from "./blob";
import { formatBytes, isActiveContent } from "./fileKinds";
import { contentDisposition, fileHeaders, isSameOrigin, notFoundResponse } from "./http";
import { getFile, isUuid, resolveSelection, zipName, zipPaths, type StoredFile } from "./rooms";
import { MAX_ARCHIVE_BYTES, type ZipManifest } from "./types";

/** Past this, a download would risk outlasting the function, so it always goes straight to Blob. */
const DIRECT_DOWNLOAD_BYTES = 100 * 1024 ** 2;

const MAX_ARCHIVE_FILES = 5000;

type Actor = Account | AuditActor;

/**
 * Signed Blob URLs can't set a filename, so the browser saves the pathname's
 * last segment. That's the real name for bulk-imported files; browser uploads
 * carry a random suffix, which is only worth accepting for large files.
 */
function redirectsToBlob(file: StoredFile): boolean {
  const stored = file.blobPathname.slice(file.blobPathname.lastIndexOf("/") + 1);
  return stored === file.name || file.sizeBytes >= DIRECT_DOWNLOAD_BYTES;
}

/**
 * Streams one file: inline for the viewer, or as an attachment with
 * `?download=1`. Attachments that `redirectsToBlob` go to a short-lived signed
 * Blob URL. Each view or download is audited; a `?thumb=1` image (the public
 * browser's icon view) and follow-up range requests are not, so one viewing
 * logs once and browsing a folder of images doesn't.
 */
export async function serveRoomFile(
  request: NextRequest,
  roomId: string,
  fileId: string,
  actor: Actor,
  detail: Record<string, unknown> = {},
): Promise<Response> {
  const file = await getFile(roomId, fileId);
  if (!file) return notFoundResponse();

  const active = isActiveContent(file.name, file.contentType);
  const attachment = active || request.nextUrl.searchParams.get("download") === "1";
  const thumb = !attachment && request.nextUrl.searchParams.get("thumb") === "1";
  const range = attachment ? null : request.headers.get("range");

  if (attachment && redirectsToBlob(file)) {
    const url = await presignedDownloadUrl(file.blobPathname).catch((error: unknown) => {
      console.error(`[data-room] couldn't presign ${file.blobPathname}; streaming instead`, error);
      return null;
    });
    if (url) {
      await recordEvent({
        roomId,
        account: actor,
        action: "download",
        fileId: file.id,
        detail: { name: file.name, ...detail },
      });
      return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, no-store" } });
    }
  }

  let blob: Awaited<ReturnType<typeof readBlob>>;
  try {
    blob = await readBlob(file.blobPathname, range);
  } catch (error) {
    console.error(`[data-room] couldn't read ${file.blobPathname}`, error);
    return new Response("File storage is unavailable. Try again shortly.", {
      status: 503,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  if (!blob || blob.statusCode !== 200) return notFoundResponse();

  if (!thumb && (!range || /^bytes=0-/.test(range.trim()))) {
    await recordEvent({
      roomId,
      account: actor,
      action: attachment ? "download" : "view",
      fileId: file.id,
      detail: { name: file.name, ...detail },
    });
  }

  const headers = fileHeaders(
    active ? "application/octet-stream" : file.contentType,
    contentDisposition(attachment ? "attachment" : "inline", file.name),
  );
  headers.set("Accept-Ranges", "bytes");
  const length = blob.headers.get("content-length");
  if (length) headers.set("Content-Length", length);
  const contentRange = blob.headers.get("content-range");
  if (contentRange) headers.set("Content-Range", contentRange);

  return new Response(blob.stream, { status: contentRange ? 206 : 200, headers });
}

interface ManifestRequest {
  all?: boolean;
  files?: unknown[];
  folders?: unknown[];
}

/**
 * Lists the selected files, everything under the selected folders, or with
 * `all` the whole room, each with its path in the zip and a signed Blob URL,
 * so the browser builds the zip itself. Every file listed is audited as a download.
 */
export async function manifestResponse(
  request: Request,
  room: { id: string; name: string },
  actor: Actor,
  detail: Record<string, unknown> = {},
): Promise<Response> {
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const body = (await request.json().catch(() => ({}))) as ManifestRequest;
  const ids = (list: unknown[] | undefined) => (Array.isArray(list) ? list.filter(isUuid) : []);
  const files = await resolveSelection(room.id, body.all === true ? "all" : ids(body.files), ids(body.folders));
  if (!files.length) return notFoundResponse();

  let urls: string[];
  try {
    urls = await presignedDownloadUrls(files.map((file) => file.blobPathname));
  } catch (error) {
    console.error("[data-room] couldn't sign download URLs", error);
    return new Response("File storage is unavailable. Try again shortly.", {
      status: 503,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  await recordEvents(
    files.map((file) => ({
      roomId: room.id,
      account: actor,
      action: "download" as const,
      fileId: file.id,
      detail: { name: file.name, archive: true, ...detail },
    })),
  );

  const paths = zipPaths(files);
  const manifest: ZipManifest = {
    name: zipName(room.name),
    files: files.map((file, i) => ({
      path: paths[i],
      size: file.sizeBytes,
      lastModified: file.createdAt,
      url: urls[i],
    })),
  };
  return Response.json(manifest, { headers: { "Cache-Control": "private, no-store" } });
}

/**
 * Streams the selection as one zip, posted from a plain form so the browser
 * saves it natively. The fallback for browsers that can't zip on their own;
 * it's capped by size. Every file in the archive is audited as a download.
 */
export async function archiveResponse(
  request: Request,
  room: { id: string; name: string },
  actor: Actor,
  detail: Record<string, unknown> = {},
): Promise<Response> {
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const form = await request.formData();
  const ids = (key: string) => form.getAll(key).filter(isUuid);
  const files = await resolveSelection(room.id, ids("file"), ids("folder"));
  if (!files.length) return notFoundResponse();
  if (files.length > MAX_ARCHIVE_FILES) {
    return new Response(`Select at most ${MAX_ARCHIVE_FILES} files per download.`, { status: 413 });
  }
  const totalBytes = files.reduce((sum, file) => sum + file.sizeBytes, 0);
  if (totalBytes > MAX_ARCHIVE_BYTES) {
    return new Response(
      `That selection is ${formatBytes(totalBytes)}; zip downloads are limited to ${formatBytes(MAX_ARCHIVE_BYTES)}. ` +
        "Download fewer folders at a time, or large files individually.",
      { status: 413 },
    );
  }

  await recordEvents(
    files.map((file) => ({
      roomId: room.id,
      account: actor,
      action: "download" as const,
      fileId: file.id,
      detail: { name: file.name, archive: true, ...detail },
    })),
  );

  const paths = zipPaths(files);
  async function* entries() {
    for (const [i, file] of files.entries()) {
      // A missing or unreadable file is left out rather than breaking the rest of the archive.
      const blob = await readBlob(file.blobPathname, null).catch((error: unknown) => {
        console.error(`[data-room] couldn't read ${file.blobPathname} for an archive`, error);
        return null;
      });
      if (!blob || blob.statusCode !== 200) continue;
      yield { name: paths[i], lastModified: new Date(file.createdAt), input: blob.stream };
    }
  }

  const zip = downloadZip(entries());
  return new Response(zip.body, {
    headers: fileHeaders("application/zip", contentDisposition("attachment", zipName(room.name))),
  });
}
