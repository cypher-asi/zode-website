import { isTeam } from "@/features/account/admin";
import { getAccount } from "@/features/account/session";
import { notFoundResponse } from "@/features/data-room/http";
import { getDeployment } from "@/features/deployments/deployments";
import { docPdfResponse } from "@/features/deployments/docs";
import { canOpenDoc } from "@/features/deployments/types";

/**
 * A deployment's one-page teaser, written out from it and rendered as of
 * today, for any signed-in account that can open it: inline, or as a download
 * with `?download=1`.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/deployments/[id]/teaser">) {
  const { id } = await ctx.params;
  const account = await getAccount();
  if (!account) return notFoundResponse();
  const deployment = await getDeployment(id);
  if (!deployment || !canOpenDoc(deployment, "teaser", { team: await isTeam(account), userId: account.userId })) {
    return notFoundResponse();
  }
  return docPdfResponse(request, deployment, "teaser");
}
