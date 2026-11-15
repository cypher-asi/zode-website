import { notFoundResponse } from "@/features/data-room/http";
import { cypherUrl } from "@/features/posts/cypher";
import { MEDIA_PREFIX } from "@/features/posts/types";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

const unavailable = () =>
  new Response("Image storage is unavailable.", { status: 503, headers: { "Cache-Control": "no-store" } });

/**
 * Serves the images in posts from the Cypher content API, from this origin so
 * the site's CSP and COEP allow them. Pathnames carry a random suffix and never
 * change, so responses are cached for good.
 */
export async function GET(_request: Request, ctx: RouteContext<"/post-media/[...path]">) {
  const { path } = await ctx.params;
  const pathname = path.join("/");
  if (!pathname.startsWith(MEDIA_PREFIX) || path.some((segment) => segment === ".." || segment === ".")) {
    return notFoundResponse();
  }

  let upstream: Response;
  try {
    upstream = await fetch(cypherUrl(`/api/v1/media/${path.map(encodeURIComponent).join("/")}`), {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    console.error(`[posts] couldn't read ${pathname}`, error);
    return unavailable();
  }
  if (upstream.status === 404) return notFoundResponse();
  if (!upstream.ok || !upstream.body) {
    console.error(`[posts] couldn't read ${pathname}`, upstream.status);
    return unavailable();
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!IMAGE_TYPES.has(contentType)) return notFoundResponse();

  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  });
  const length = upstream.headers.get("content-length");
  if (length) headers.set("Content-Length", length);
  return new Response(upstream.body, { headers });
}
