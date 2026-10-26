import { downloadZip } from "client-zip";
import { recordEvents } from "@/features/data-room/audit";
import { readBlob } from "@/features/data-room/blob";
import { formatBytes } from "@/features/data-room/fileKinds";
import { contentDisposition, fileHeaders, isSameOrigin, notFoundResponse } from "@/features/data-room/http";
import { isUuid, resolveSelection, roomAccess, zipName, zipPaths } from "@/features/data-room/rooms";
import { MAX_ARCHIVE_BYTES } from "@/features/data-room/types";

const MAX_ARCHIVE_FILES = 5000;

/** The zip streams through this function, so it must finish within this many seconds. */
export const maxDuration = 300;

/**
 * Streams the selected files, and everything under the selected folders, as one
 * zip. Posted from a plain form so the browser handles the download natively.
 * Every file in the archive is audited as a download. The fallback for browsers
 * that can't zip on their own (see the manifest route); it's capped by size.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/data-rooms/[roomId]/archive">) {
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const { roomId } = await ctx.params;
  const access = await roomAccess(roomId);
  if (!access) return notFoundResponse();

  const form = await request.formData();
  const ids = (key: string) => form.getAll(key).filter(isUuid);
  const files = await resolveSelection(roomId, ids("file"), ids("folder"));
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
      roomId,
      account: access.account,
      action: "download" as const,
      fileId: file.id,
      detail: { name: file.name, archive: true },
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
    headers: fileHeaders("application/zip", contentDisposition("attachment", zipName(access.room.name))),
  });
}
