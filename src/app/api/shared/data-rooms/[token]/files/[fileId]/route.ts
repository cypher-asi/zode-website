import type { NextRequest } from "next/server";
import { serveRoomFile } from "@/features/data-room/downloads";
import { notFoundResponse } from "@/features/data-room/http";
import { roomByShareToken, shareActor } from "@/features/data-room/rooms";

/** The same file stream as a member gets, authorized by the room's public link. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/shared/data-rooms/[token]/files/[fileId]">) {
  const { token, fileId } = await ctx.params;
  const room = await roomByShareToken(token);
  if (!room) return notFoundResponse();
  return serveRoomFile(request, room.id, fileId, await shareActor(), { via: "share-link" });
}
