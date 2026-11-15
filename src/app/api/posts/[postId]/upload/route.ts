import { isTeam } from "@/features/account/admin";
import { getAccount } from "@/features/account/session";
import { isSameOrigin, notFoundResponse } from "@/features/data-room/http";
import { forwardToSiteApi } from "@/features/posts/cypher";
import { postBlobPrefix } from "@/features/posts/types";

/**
 * Issues client tokens so a team member's browser uploads a post's images
 * straight to the Cypher Blob store, under that post's prefix. Cypher checks
 * the post and the prefix again and signs the token.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/posts/[postId]/upload">) {
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const account = await getAccount();
  if (!account || !(await isTeam(account))) return notFoundResponse();
  const { postId } = await ctx.params;

  const body = (await request.json().catch(() => null)) as {
    type?: string;
    payload?: { pathname?: unknown };
  } | null;
  if (body?.type !== "blob.generate-client-token") return new Response("Bad request", { status: 400 });
  const pathname = body.payload?.pathname;
  if (typeof pathname !== "string" || !pathname.startsWith(postBlobPrefix(postId)) || pathname.includes("..")) {
    return Response.json({ error: "Uploads must go into this post." }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await forwardToSiteApi(`/posts/${encodeURIComponent(postId)}/upload`, JSON.stringify(body));
  } catch (error) {
    console.error("[posts] upload token request failed", postId, error);
    return Response.json({ error: "Uploads are unavailable right now." }, { status: 503 });
  }
  if (upstream.status === 404) return notFoundResponse();
  const result = (await upstream.json().catch(() => null)) as { error?: { message?: string } } | null;
  if (!upstream.ok) {
    if (upstream.status >= 500 || upstream.status === 401 || upstream.status === 403) {
      console.error("[posts] upload token refused", postId, upstream.status, result);
      return Response.json({ error: "Uploads are unavailable right now." }, { status: 503 });
    }
    return Response.json({ error: result?.error?.message ?? "Upload failed." }, { status: 400 });
  }
  return Response.json(result);
}
