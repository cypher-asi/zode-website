import { archiveResponse } from "@/features/data-room/downloads";
import { notFoundResponse } from "@/features/data-room/http";
import { roomByShareToken, shareAudit } from "@/features/data-room/shareLinks";

/** The zip streams through this function, so it must finish within this many seconds. */
export const maxDuration = 300;

/** Server-built zip for browsers that can't assemble one, authorized by a share link. */
export async function POST(request: Request, ctx: RouteContext<"/api/shared/data-rooms/[token]/archive">) {
  const link = await roomByShareToken((await ctx.params).token);
  if (!link) return notFoundResponse();
  const { actor, detail } = await shareAudit(link);
  return archiveResponse(request, link, actor, detail);
}
