import "server-only";

export const notFoundResponse = (): Response =>
  new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });

/** RFC 6266 disposition with an ASCII fallback and the exact UTF-8 name. */
export function contentDisposition(type: "inline" | "attachment", name: string): string {
  const fallback = name.replace(/[^\x20-\x7e]|["\\%]/g, "_");
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/**
 * Headers for every file response. Files are fetched by the viewer, never
 * framed, so the sandbox CSP keeps anything that is opened directly inert.
 * With an `etag`, the browser may keep the bytes but must revalidate each use,
 * so access is still checked and the view still audited every time.
 */
export function fileHeaders(contentType: string, disposition: string, etag?: string): Headers {
  return new Headers({
    "Content-Type": contentType,
    "Content-Disposition": disposition,
    "Cache-Control": etag ? "private, no-cache" : "private, no-store",
    ...(etag ? { ETag: etag } : {}),
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'",
  });
}

/** Whether an `If-None-Match` header names `etag`, weakly compared as RFC 9110 has it. */
export function etagMatches(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) return false;
  const strip = (tag: string) => tag.trim().replace(/^W\//, "");
  return ifNoneMatch.split(",").some((tag) => tag.trim() === "*" || strip(tag) === strip(etag));
}

/** Rejects cross-site POSTs; the SameSite=Lax session cookie already does, this is belt and braces. */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}
