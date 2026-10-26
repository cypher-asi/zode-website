import { recordEvents } from "@/features/data-room/audit";
import { presignedDownloadUrls } from "@/features/data-room/blob";
import { isSameOrigin, notFoundResponse } from "@/features/data-room/http";
import { isUuid, resolveSelection, roomAccess, zipName, zipPaths } from "@/features/data-room/rooms";
import type { ZipManifest } from "@/features/data-room/types";

interface ManifestRequest {
  all?: boolean;
  files?: unknown[];
  folders?: unknown[];
}

/**
 * Lists the selected files, everything under the selected folders, or with
 * `all` the whole room, each with its path in the zip and a signed Blob URL,
 * so the browser builds the zip itself with no size or time limit. Every file
 * listed is audited as a download.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/data-rooms/[roomId]/manifest">) {
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const { roomId } = await ctx.params;
  const access = await roomAccess(roomId);
  if (!access) return notFoundResponse();

  const body = (await request.json().catch(() => ({}))) as ManifestRequest;
  const ids = (list: unknown[] | undefined) => (Array.isArray(list) ? list.filter(isUuid) : []);
  const files = await resolveSelection(roomId, body.all === true ? "all" : ids(body.files), ids(body.folders));
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
      roomId,
      account: access.account,
      action: "download" as const,
      fileId: file.id,
      detail: { name: file.name, archive: true },
    })),
  );

  const paths = zipPaths(files);
  const manifest: ZipManifest = {
    name: zipName(access.room.name),
    files: files.map((file, i) => ({
      path: paths[i],
      size: file.sizeBytes,
      lastModified: file.createdAt,
      url: urls[i],
    })),
  };
  return Response.json(manifest, { headers: { "Cache-Control": "private, no-store" } });
}
