import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { AVATAR_TYPES, MAX_AVATAR_BYTES, avatarBlobPrefix } from "@/features/account/profile";
import { getAccount } from "@/features/account/session";
import { isSameOrigin, notFoundResponse } from "@/features/data-room/http";
import { RATE_LIMITED, withinLimits } from "@/lib/rateLimit";

/**
 * Issues client tokens so a signed-in user's browser uploads a profile photo
 * straight to the private Blob store, under that user's prefix only. The photo
 * is set afterwards by `setAvatarAction`.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const account = await getAccount();
  if (!account) return notFoundResponse();

  const body = (await request.json()) as HandleUploadBody;
  if (body.type !== "blob.generate-client-token") return new Response("Bad request", { status: 400 });

  const allowed = await withinLimits([{ key: `avatar:user:${account.userId}`, max: 20, windowSeconds: 60 * 60 }]);
  if (!allowed) return Response.json({ error: RATE_LIMITED }, { status: 429 });

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(avatarBlobPrefix(account.userId)) || pathname.includes("..")) {
          throw new Error("Uploads must go into your account.");
        }
        return {
          allowedContentTypes: AVATAR_TYPES,
          addRandomSuffix: true,
          maximumSizeInBytes: MAX_AVATAR_BYTES,
          validUntil: Date.now() + 10 * 60 * 1000,
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 400 });
  }
}
