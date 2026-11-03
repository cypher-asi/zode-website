import { manifestResponse } from "@/features/data-room/downloads";
import { notFoundResponse } from "@/features/data-room/http";
import { roomAccess } from "@/features/data-room/rooms";

/**
 * Lists the selected files, everything under the selected folders, or with
 * `all` the whole room, each with a signed Blob URL, so the browser builds
 * the zip itself with no size or time limit.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/data-rooms/[roomId]/manifest">) {
  const { roomId } = await ctx.params;
  const access = await roomAccess(roomId);
  if (!access) return notFoundResponse();
  return manifestResponse(request, access.room, access.account);
}
