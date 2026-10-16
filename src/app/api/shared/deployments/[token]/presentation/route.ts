import { contentDisposition, fileHeaders, notFoundResponse } from "@/features/data-room/http";
import { getSharedDeployment } from "@/features/deployments/deployments";
import { todayIso } from "@/features/deployments/format";
import { presentationOf } from "@/features/presentations/content";
import { renderPresentationPdf } from "@/features/presentations/pdf";
import { presentationFileName } from "@/features/presentations/types";

/**
 * A shared deployment's presentation, written out from it as of today, for
 * anyone with its link: inline, or as a download with `?download=1`.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/shared/deployments/[token]/presentation">) {
  const { token } = await ctx.params;
  const deployment = await getSharedDeployment(token);
  if (!deployment) return notFoundResponse();

  const bytes = await renderPresentationPdf(presentationOf(deployment), todayIso());
  const download = new URL(request.url).searchParams.has("download");
  const headers = fileHeaders(
    "application/pdf",
    contentDisposition(download ? "attachment" : "inline", presentationFileName(deployment.name)),
  );
  headers.set("Content-Length", String(bytes.byteLength));
  return new Response(bytes as Uint8Array<ArrayBuffer>, { headers });
}
