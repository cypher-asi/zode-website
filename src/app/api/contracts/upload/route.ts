import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { COMPUTE_CONTRACT_PREFIX } from "@/features/contracts/contracts";
import { isSameOrigin, notFoundResponse } from "@/features/data-room/http";
import { teamAccount } from "@/features/zrm/access";

const MAX_UPLOAD_BYTES = 50 * 1024 ** 2;

/**
 * Issues short-lived client tokens so the team's browsers upload an executed
 * compute contract straight to the private Blob store, under the contracts
 * prefix and as a PDF only. The contract is recorded afterwards by
 * `recordComputeContractAction`.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  if (!(await teamAccount())) return notFoundResponse();

  const body = (await request.json()) as HandleUploadBody;
  if (body.type !== "blob.generate-client-token") return new Response("Bad request", { status: 400 });

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(COMPUTE_CONTRACT_PREFIX) || pathname.includes("..")) {
          throw new Error("Contracts must be uploaded as contracts.");
        }
        return {
          addRandomSuffix: true,
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          validUntil: Date.now() + 15 * 60 * 1000,
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 400 });
  }
}
