import { isTeam } from "@/features/account/admin";
import { getAccount } from "@/features/account/session";
import { contentDisposition, fileHeaders, notFoundResponse } from "@/features/data-room/http";
import { getDeploymentFor } from "@/features/deployments/deployments";
import { todayIso } from "@/features/deployments/format";
import { teaserOf } from "@/features/teasers/content";
import { renderTeaserPdf } from "@/features/teasers/pdf";
import { teaserFileName } from "@/features/teasers/types";

/**
 * A deployment's one-page teaser, written out from it and rendered as of
 * today, for any signed-in account that can open it: inline, or as a download
 * with `?download=1`.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/deployments/[id]/teaser">) {
  const { id } = await ctx.params;
  const account = await getAccount();
  if (!account) return notFoundResponse();
  const deployment = await getDeploymentFor(id, { team: await isTeam(account), userId: account.userId });
  if (!deployment) return notFoundResponse();

  const bytes = await renderTeaserPdf(teaserOf(deployment), todayIso());
  const download = new URL(request.url).searchParams.has("download");
  const headers = fileHeaders(
    "application/pdf",
    contentDisposition(download ? "attachment" : "inline", teaserFileName(deployment.name)),
  );
  headers.set("Content-Length", String(bytes.byteLength));
  return new Response(bytes as Uint8Array<ArrayBuffer>, { headers });
}
