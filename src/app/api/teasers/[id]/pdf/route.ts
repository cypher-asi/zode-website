import { contentDisposition, fileHeaders, notFoundResponse } from "@/features/data-room/http";
import { todayIso } from "@/features/deployments/format";
import { renderTeaserPdf } from "@/features/teasers/pdf";
import { getTeaser } from "@/features/teasers/teasers";
import { teaserFileName } from "@/features/teasers/types";
import { teamAccount } from "@/features/zrm/access";

/**
 * A teaser's one-page PDF, rendered as of today, for the ZODE team: inline
 * for the editor's preview, or as a download with `?download=1`.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/teasers/[id]/pdf">) {
  const { id } = await ctx.params;
  if (!(await teamAccount())) return notFoundResponse();
  const teaser = await getTeaser(id);
  if (!teaser) return notFoundResponse();

  const bytes = await renderTeaserPdf(teaser, todayIso());
  const download = new URL(request.url).searchParams.has("download");
  const headers = fileHeaders(
    "application/pdf",
    contentDisposition(download ? "attachment" : "inline", teaserFileName(teaser.name)),
  );
  headers.set("Content-Length", String(bytes.byteLength));
  return new Response(bytes as Uint8Array<ArrayBuffer>, { headers });
}
