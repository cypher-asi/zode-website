import { manifestResponse } from "@/features/data-room/downloads";
import { notFoundResponse } from "@/features/data-room/http";
import { roomByShareToken, shareActor } from "@/features/data-room/rooms";

/** Signed Blob URLs for a zip of the public room, same selection rules as a member's manifest. */
export async function POST(request: Request, ctx: RouteContext<"/api/shared/data-rooms/[token]/manifest">) {
  const room = await roomByShareToken((await ctx.params).token);
  if (!room) return notFoundResponse();
  return manifestResponse(request, room, await shareActor(), { via: "share-link" });
}
