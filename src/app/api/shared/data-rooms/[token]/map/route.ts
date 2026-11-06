import { notFoundResponse } from "@/features/data-room/http";
import { getRoomSite } from "@/features/data-room/rooms";
import { roomByShareToken } from "@/features/data-room/shareLinks";
import { siteMapResponse } from "@/features/data-room/siteMap";
import { clientMeta } from "@/lib/clientMeta";
import { RATE_LIMITED, withinLimits } from "@/lib/rateLimit";

/** The public summary's satellite map. The link is the credential; Google still bills each image. */
export async function GET(_request: Request, ctx: RouteContext<"/api/shared/data-rooms/[token]/map">) {
  const { token } = await ctx.params;
  const room = await roomByShareToken(token);
  if (!room) return notFoundResponse();
  const site = await getRoomSite(room.id);
  if (!site) return notFoundResponse();
  const { ip } = await clientMeta();
  if (!(await withinLimits([{ key: `room-map:link:${ip ?? token}`, max: 60, windowSeconds: 60 * 60 }]))) {
    return new Response(RATE_LIMITED, { status: 429, headers: { "Cache-Control": "private, no-store" } });
  }
  return siteMapResponse(site.address);
}
