import { notFoundResponse } from "@/features/data-room/http";
import { getSharedDoc } from "@/features/deployments/deployments";
import { docPdfResponse } from "@/features/deployments/docs";

/**
 * A presentation shared on its own, written out from its deployment as of
 * today, for anyone with its link: inline, or as a download with `?download=1`.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/shared/presentations/[token]">) {
  const deployment = await getSharedDoc("presentation", (await ctx.params).token);
  if (!deployment) return notFoundResponse();
  return docPdfResponse(request, deployment, "presentation");
}
