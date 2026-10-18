import { notFoundResponse } from "@/features/data-room/http";
import { getSharedDeployment } from "@/features/deployments/deployments";
import { docPdfResponse } from "@/features/deployments/docs";
import { sharedWithDeployment } from "@/features/deployments/types";

/**
 * A shared deployment's one-page teaser, written out from it as of today, for
 * anyone with its link unless the teaser is kept to the ZODE team: inline, or
 * as a download with `?download=1`.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/shared/deployments/[token]/teaser">) {
  const { token } = await ctx.params;
  const deployment = await getSharedDeployment(token);
  if (!deployment || !sharedWithDeployment(deployment, "teaser")) return notFoundResponse();
  return docPdfResponse(request, deployment, "teaser");
}
