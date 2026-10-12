import type { NextRequest } from "next/server";
import { recordEvent } from "@/features/data-room/audit";
import { presignedDownloadUrl, readBlob } from "@/features/data-room/blob";
import { isActiveContent } from "@/features/data-room/fileKinds";
import { contentDisposition, fileHeaders, notFoundResponse } from "@/features/data-room/http";
import { getFile, roomAccess, type StoredFile } from "@/features/data-room/rooms";

/** Past this, a download would risk outlasting the function, so it always goes straight to Blob. */
const DIRECT_DOWNLOAD_BYTES = 100 * 1024 ** 2;

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
 * Streams one file to a room member: inline for the viewer, or as an
 * attachment with `?download=1`. Attachments that `redirectsToBlob` are sent
 * to a short-lived signed Blob URL instead. Each view or download is audited;
 * follow-up range requests (media seeking) are not, so one viewing logs once.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/data-rooms/[roomId]/files/[fileId]">) {
  const { roomId, fileId } = await ctx.params;
  const access = await roomAccess(roomId);
  if (!access) return notFoundResponse();
  const file = await getFile(roomId, fileId);
  if (!file) return notFoundResponse();

  const active = isActiveContent(file.name, file.contentType);
  const attachment = active || request.nextUrl.searchParams.get("download") === "1";
  const range = attachment ? null : request.headers.get("range");

  if (attachment && redirectsToBlob(file)) {
    const url = await presignedDownloadUrl(file.blobPathname).catch((error: unknown) => {
      console.error(`[data-room] couldn't presign ${file.blobPathname}; streaming instead`, error);
      return null;
    });
    if (url) {
      await recordEvent({
        roomId,
        account: access.account,
        action: "download",
        fileId: file.id,
        detail: { name: file.name },
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

  if (!range || /^bytes=0-/.test(range.trim())) {
    await recordEvent({
      roomId,
      account: access.account,
      action: attachment ? "download" : "view",
      fileId: file.id,
      detail: { name: file.name },
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
