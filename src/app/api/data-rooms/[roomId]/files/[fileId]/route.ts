import type { NextRequest } from "next/server";
import { serveRoomFile } from "@/features/data-room/downloads";
import { notFoundResponse } from "@/features/data-room/http";
import { roomAccess } from "@/features/data-room/rooms";

/**
 * Streams one file to a room member: inline for the viewer, or as an
 * attachment with `?download=1`.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/data-rooms/[roomId]/files/[fileId]">) {
  const { roomId, fileId } = await ctx.params;
  const access = await roomAccess(roomId);
  if (!access) return notFoundResponse();
  return serveRoomFile(request, roomId, fileId, access.account);
}
