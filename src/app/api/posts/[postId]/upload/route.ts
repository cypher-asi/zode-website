import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { isTeam } from "@/features/account/admin";
import { getAccount } from "@/features/account/session";
import { isSameOrigin, notFoundResponse } from "@/features/data-room/http";
import { postBlobPrefix } from "@/features/posts/blob";
import { getPost } from "@/features/posts/posts";

const MAX_IMAGE_BYTES = 10 * 1024 ** 2;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** Issues client tokens so a team member's browser uploads a post's images straight to Blob, under that post's prefix. */
export async function POST(request: Request, ctx: RouteContext<"/api/posts/[postId]/upload">) {
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const account = await getAccount();
  if (!account || !(await isTeam(account))) return notFoundResponse();
  const { postId } = await ctx.params;
  if (!(await getPost(postId))) return notFoundResponse();

  const body = (await request.json()) as HandleUploadBody;
  if (body.type !== "blob.generate-client-token") return new Response("Bad request", { status: 400 });

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(postBlobPrefix(postId)) || pathname.includes("..")) {
          throw new Error("Uploads must go into this post.");
        }
        return {
          allowedContentTypes: IMAGE_TYPES,
          addRandomSuffix: true,
          maximumSizeInBytes: MAX_IMAGE_BYTES,
          validUntil: Date.now() + 10 * 60 * 1000,
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 400 });
  }
}
