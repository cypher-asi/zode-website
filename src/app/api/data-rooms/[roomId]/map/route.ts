import { notFoundResponse } from "@/features/data-room/http";
import { getRoomSite, roomAccess } from "@/features/data-room/rooms";
import { siteMapResponse } from "@/features/data-room/siteMap";
import { RATE_LIMITED, withinLimits } from "@/lib/rateLimit";

/**
 * The room's site on a satellite map, for its summary. Fetched here so the
 * Maps key stays on the server and the image is same-origin. Google bills
 * each one, so browsers keep it for a day; the summary's `?v=` changes with
 * the address.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/data-rooms/[roomId]/map">) {
  const { roomId } = await ctx.params;
  const access = await roomAccess(roomId);
  if (!access) return notFoundResponse();
  const site = await getRoomSite(roomId);
  if (!site) return notFoundResponse();
  if (!(await withinLimits([{ key: `room-map:user:${access.account.userId}`, max: 300, windowSeconds: 60 * 60 }]))) {
    return new Response(RATE_LIMITED, { status: 429, headers: { "Cache-Control": "private, no-store" } });
  }
  return siteMapResponse(site.address);
}
