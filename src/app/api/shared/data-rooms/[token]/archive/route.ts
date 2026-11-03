import { archiveResponse } from "@/features/data-room/downloads";
import { notFoundResponse } from "@/features/data-room/http";
import { roomByShareToken, shareActor } from "@/features/data-room/rooms";

/** The zip streams through this function, so it must finish within this many seconds. */
export const maxDuration = 300;

/** Server-built zip for browsers that can't assemble one, authorized by the public link. */
export async function POST(request: Request, ctx: RouteContext<"/api/shared/data-rooms/[token]/archive">) {
  const room = await roomByShareToken((await ctx.params).token);
  if (!room) return notFoundResponse();
  return archiveResponse(request, room, await shareActor(), { via: "share-link" });
}
