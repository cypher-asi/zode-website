import type { NextRequest } from "next/server";
import { serveRoomFile } from "@/features/data-room/downloads";
import { notFoundResponse } from "@/features/data-room/http";
import { getFile } from "@/features/data-room/rooms";
import { roomByShareToken, shareAudit } from "@/features/data-room/shareLinks";

/** The same file stream as a member gets, authorized by a share link and audited as its recipient. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/shared/data-rooms/[token]/files/[fileId]">) {
  const { token, fileId } = await ctx.params;
  const link = await roomByShareToken(token);
  if (!link) return notFoundResponse();
  const [{ actor, detail }, file] = await Promise.all([shareAudit(link), getFile(link.id, fileId)]);
  return serveRoomFile(request, link.id, file, actor, detail);
}
