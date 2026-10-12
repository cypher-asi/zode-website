import { AVATAR_TYPES, avatarVersion, loadProfile } from "@/features/account/profile";
import { readBlob } from "@/features/data-room/blob";
import { notFoundResponse } from "@/features/data-room/http";

/**
 * Serves a user's profile photo from the private Blob store, from this origin
 * so the site's CSP and COEP allow it. Public, so the login form's saved
 * accounts can show it too. A URL naming the current photo's version is
 * cached for good; any other gets whatever is current, revalidated each time.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/account/avatar/[userId]">) {
  const { userId } = await ctx.params;
  const pathname = (await loadProfile(userId))?.avatarPathname;
  if (!pathname) return notFoundResponse();

  let blob: Awaited<ReturnType<typeof readBlob>>;
  try {
    blob = await readBlob(pathname, null);
  } catch (error) {
    console.error(`[avatar] couldn't read ${pathname}`, error);
    return new Response("Image storage is unavailable.", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (!blob || blob.statusCode !== 200) return notFoundResponse();

  const contentType = blob.blob.contentType;
  if (!AVATAR_TYPES.includes(contentType)) return notFoundResponse();

  const current = new URL(request.url).searchParams.get("v") === avatarVersion(pathname);
  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": current ? "public, max-age=31536000, immutable" : "no-cache",
    "X-Content-Type-Options": "nosniff",
  });
  const length = blob.headers.get("content-length");
  if (length) headers.set("Content-Length", length);
  return new Response(blob.stream, { headers });
}
