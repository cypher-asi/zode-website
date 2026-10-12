import { downloadZip } from "client-zip";
import { recordEvents } from "@/features/data-room/audit";
import { readBlob } from "@/features/data-room/blob";
import { formatBytes } from "@/features/data-room/fileKinds";
import { contentDisposition, fileHeaders, isSameOrigin, notFoundResponse } from "@/features/data-room/http";
import { isUuid, resolveSelection, roomAccess } from "@/features/data-room/rooms";
import { MAX_ARCHIVE_BYTES } from "@/features/data-room/types";

const MAX_ARCHIVE_FILES = 5000;

/** The zip streams through this function, so it must finish within this many seconds. */
export const maxDuration = 300;

/** Gives repeated paths a " (2)" suffix before the extension, as a file manager would. */
function uniquePaths(paths: string[]): string[] {
  const seen = new Map<string, number>();
  return paths.map((path) => {
    const count = seen.get(path.toLowerCase()) ?? 0;
    seen.set(path.toLowerCase(), count + 1);
    if (!count) return path;
    const dot = path.lastIndexOf(".");
    const slash = path.lastIndexOf("/");
    return dot > slash + 1 ? `${path.slice(0, dot)} (${count + 1})${path.slice(dot)}` : `${path} (${count + 1})`;
  });
}

/**
 * Streams the selected files, and everything under the selected folders, as one
 * zip. Posted from a plain form so the browser handles the download natively.
 * Every file in the archive is audited as a download.
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

  const paths = uniquePaths(files.map((file) => (file.path ? `${file.path}/${file.name}` : file.name)));
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

  const stamp = new Date().toISOString().slice(0, 10);
  const zip = downloadZip(entries());
  return new Response(zip.body, {
    headers: fileHeaders("application/zip", contentDisposition("attachment", `${access.room.name} ${stamp}.zip`)),
  });
}
