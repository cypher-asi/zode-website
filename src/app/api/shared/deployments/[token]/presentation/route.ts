import { contentDisposition, fileHeaders, notFoundResponse } from "@/features/data-room/http";
import { getSharedDeployment } from "@/features/deployments/deployments";
import { todayIso } from "@/features/deployments/format";
import { renderPresentationPdf } from "@/features/presentations/pdf";
import { getPresentationFor } from "@/features/presentations/presentations";
import { presentationFileName } from "@/features/presentations/types";

/**
 * A shared deployment's presentation PDF, as of today, for anyone with its
 * link: inline, or as a download with `?download=1`.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/shared/deployments/[token]/presentation">) {
  const { token } = await ctx.params;
  const deployment = await getSharedDeployment(token);
  if (!deployment) return notFoundResponse();
  const presentation = await getPresentationFor(deployment.id);
  if (!presentation) return notFoundResponse();

  const bytes = await renderPresentationPdf(presentation, todayIso());
  const download = new URL(request.url).searchParams.has("download");
  const headers = fileHeaders(
    "application/pdf",
    contentDisposition(download ? "attachment" : "inline", presentationFileName(deployment.name)),
  );
  headers.set("Content-Length", String(bytes.byteLength));
  return new Response(bytes as Uint8Array<ArrayBuffer>, { headers });
}
