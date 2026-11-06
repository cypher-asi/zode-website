import { manifestResponse } from "@/features/data-room/downloads";
import { notFoundResponse } from "@/features/data-room/http";
import { roomByShareToken, shareAudit } from "@/features/data-room/shareLinks";

/** Signed Blob URLs for a zip of the shared room, same selection rules as a member's manifest. */
export async function POST(request: Request, ctx: RouteContext<"/api/shared/data-rooms/[token]/manifest">) {
  const link = await roomByShareToken((await ctx.params).token);
  if (!link) return notFoundResponse();
  const { actor, detail } = await shareAudit(link);
  return manifestResponse(request, link, actor, detail);
}
