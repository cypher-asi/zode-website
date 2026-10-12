import { readBlob } from "@/features/data-room/blob";
import { notFoundResponse } from "@/features/data-room/http";
import { MEDIA_PREFIX } from "@/features/posts/types";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/**
 * Serves the images in posts from the private Blob store, from this origin so
 * the site's CSP and COEP allow them. Pathnames carry a random suffix and never
 * change, so responses are cached for good.
 */
export async function GET(_request: Request, ctx: RouteContext<"/post-media/[...path]">) {
  const { path } = await ctx.params;
  const pathname = path.join("/");
  if (!pathname.startsWith(MEDIA_PREFIX) || path.some((segment) => segment === ".." || segment === ".")) {
    return notFoundResponse();
  }

  let blob: Awaited<ReturnType<typeof readBlob>>;
  try {
    blob = await readBlob(pathname, null);
  } catch (error) {
    console.error(`[posts] couldn't read ${pathname}`, error);
    return new Response("Image storage is unavailable.", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (!blob || blob.statusCode !== 200) return notFoundResponse();

  const contentType = blob.blob.contentType;
  if (!IMAGE_TYPES.has(contentType)) return notFoundResponse();

  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  });
  const length = blob.headers.get("content-length");
  if (length) headers.set("Content-Length", length);
  return new Response(blob.stream, { headers });
}
