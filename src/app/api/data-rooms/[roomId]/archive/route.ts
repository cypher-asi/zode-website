import { archiveResponse } from "@/features/data-room/downloads";
import { notFoundResponse } from "@/features/data-room/http";
import { roomAccess } from "@/features/data-room/rooms";

/** The zip streams through this function, so it must finish within this many seconds. */
export const maxDuration = 300;

/**
 * Streams the selection as one zip. The fallback for browsers that can't zip
 * on their own (see the manifest route); it's capped by size.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/data-rooms/[roomId]/archive">) {
  const { roomId } = await ctx.params;
  const access = await roomAccess(roomId);
  if (!access) return notFoundResponse();
  return archiveResponse(request, access.room, access.account);
}
