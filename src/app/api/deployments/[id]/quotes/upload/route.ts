import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { isSameOrigin, notFoundResponse } from "@/features/data-room/http";
import { quoteBlobPrefix } from "@/features/deployments/bom/bom";
import { getDeploymentFor } from "@/features/deployments/deployments";
import { teamAccount } from "@/features/zrm/access";

const MAX_UPLOAD_BYTES = 500 * 1024 ** 2;

/**
 * Issues short-lived client tokens so the ZODE team's browsers upload quote
 * files straight to the private Blob store, past the function body size
 * limit. Tokens only cover the deployment's quote prefix; the file is
 * recorded afterwards by `attachQuoteFileAction`.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/deployments/[id]/quotes/upload">) {
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const { id } = await ctx.params;
  const account = await teamAccount();
  if (!account || !(await getDeploymentFor(id, { team: true, userId: account.userId }))) return notFoundResponse();

  const body = (await request.json()) as HandleUploadBody;
  if (body.type !== "blob.generate-client-token") return new Response("Bad request", { status: 400 });

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(quoteBlobPrefix(id)) || pathname.includes("..")) {
          throw new Error("Uploads must go into this deployment's quotes.");
        }
        return {
          addRandomSuffix: true,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          validUntil: Date.now() + 60 * 60 * 1000,
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 400 });
  }
}
