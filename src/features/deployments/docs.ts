import "server-only";
import { contentDisposition, fileHeaders } from "@/features/data-room/http";
import { presentationOf } from "@/features/presentations/content";
import { renderPresentationPdf } from "@/features/presentations/pdf";
import { presentationFileName, presentationName } from "@/features/presentations/types";
import { teaserOf } from "@/features/teasers/content";
import { renderTeaserPdf } from "@/features/teasers/pdf";
import { teaserFileName } from "@/features/teasers/types";
import { todayIso } from "./format";
import type { Deployment, DeploymentDoc } from "./types";

/** The download name of deployment `d`'s `doc`. */
export const docFileName = (d: Deployment, doc: DeploymentDoc): string =>
  doc === "teaser" ? teaserFileName(d.name) : presentationFileName(presentationName(d));

/**
 * Deployment `d`'s teaser or presentation, written out from it and rendered
 * as of today: inline, or as a download when `request` asks with `?download=1`.
 */
export async function docPdfResponse(request: Request, d: Deployment, doc: DeploymentDoc): Promise<Response> {
  const bytes =
    doc === "teaser"
      ? await renderTeaserPdf(teaserOf(d), todayIso())
      : await renderPresentationPdf(presentationOf(d), todayIso());
  const download = new URL(request.url).searchParams.has("download");
  const headers = fileHeaders("application/pdf", contentDisposition(download ? "attachment" : "inline", docFileName(d, doc)));
  headers.set("Content-Length", String(bytes.byteLength));
  return new Response(bytes as Uint8Array<ArrayBuffer>, { headers });
}
