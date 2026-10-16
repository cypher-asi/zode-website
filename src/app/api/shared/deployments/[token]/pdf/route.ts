import { contentDisposition, fileHeaders, notFoundResponse } from "@/features/data-room/http";
import { getSharedDeployment } from "@/features/deployments/deployments";
import { todayIso } from "@/features/deployments/format";
import { renderDeploymentPdf } from "@/features/deployments/pdf";
import { deploymentFileName } from "@/features/deployments/types";

/**
 * A shared deployment's public PDF (no notes, credit or data room), as of
 * today, for anyone with its link: inline for the viewer, or as a download
 * with `?download=1`.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/shared/deployments/[token]/pdf">) {
  const { token } = await ctx.params;
  const deployment = await getSharedDeployment(token);
  if (!deployment) return notFoundResponse();

  const bytes = await renderDeploymentPdf(deployment, todayIso(), {
    audience: "public",
  });
  const download = new URL(request.url).searchParams.has("download");
  const headers = fileHeaders(
    "application/pdf",
    contentDisposition(download ? "attachment" : "inline", deploymentFileName(deployment.name)),
  );
  headers.set("Content-Length", String(bytes.byteLength));
  return new Response(bytes as Uint8Array<ArrayBuffer>, { headers });
}
