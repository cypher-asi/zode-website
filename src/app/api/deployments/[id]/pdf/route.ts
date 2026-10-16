import { isTeam } from "@/features/account/admin";
import { getAccount } from "@/features/account/session";
import { contentDisposition, fileHeaders, notFoundResponse } from "@/features/data-room/http";
import { getDeploymentFor } from "@/features/deployments/deployments";
import { todayIso } from "@/features/deployments/format";
import { renderDeploymentPdf } from "@/features/deployments/pdf";
import { deploymentFileName } from "@/features/deployments/types";

/** A deployment's ZODE-branded summary PDF, rendered as of today, for any signed-in account that can open it. */
export async function GET(_request: Request, ctx: RouteContext<"/api/deployments/[id]/pdf">) {
  const { id } = await ctx.params;
  const account = await getAccount();
  if (!account) return notFoundResponse();
  const deployment = await getDeploymentFor(id, { team: await isTeam(account), userId: account.userId });
  if (!deployment) return notFoundResponse();

  const bytes = await renderDeploymentPdf(deployment, todayIso());
  const headers = fileHeaders("application/pdf", contentDisposition("attachment", deploymentFileName(deployment.name)));
  headers.set("Content-Length", String(bytes.byteLength));
  return new Response(bytes as Uint8Array<ArrayBuffer>, { headers });
}
