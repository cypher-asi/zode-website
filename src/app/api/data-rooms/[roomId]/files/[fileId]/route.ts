import type { NextRequest } from "next/server";
import { serveRoomFile } from "@/features/data-room/downloads";
import { notFoundResponse } from "@/features/data-room/http";
import { getFile, isUuid, roomAccess } from "@/features/data-room/rooms";

/**
 * Streams one file to a room member: inline for the viewer, or as an
 * attachment with `?download=1`. The file is looked up alongside the access
 * check, but only served once that passes.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/data-rooms/[roomId]/files/[fileId]">) {
  const { roomId, fileId } = await ctx.params;
  const [access, file] = await Promise.all([roomAccess(roomId), isUuid(roomId) ? getFile(roomId, fileId) : null]);
  if (!access) return notFoundResponse();
  return serveRoomFile(request, roomId, file, access.account);
}
