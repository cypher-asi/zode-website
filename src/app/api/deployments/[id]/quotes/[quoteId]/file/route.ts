import type { NextRequest } from "next/server";
import { readBlob } from "@/features/data-room/blob";
import { isActiveContent } from "@/features/data-room/fileKinds";
import { contentDisposition, fileHeaders, notFoundResponse } from "@/features/data-room/http";
import { quoteFileSource } from "@/features/deployments/bom/bom";
import { teamAccount } from "@/features/zrm/access";

/**
 * Streams a quote's file to the ZODE team: inline for the Quotes tab's
 * preview, or as an attachment with `?download=1`. It's the file uploaded to
 * the quote, or the one it links in the deployment's data room.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/deployments/[id]/quotes/[quoteId]/file">) {
  const { id, quoteId } = await ctx.params;
  if (!(await teamAccount())) return notFoundResponse();
  const file = await quoteFileSource(id, quoteId);
  if (!file) return notFoundResponse();

  const active = isActiveContent(file.name, file.contentType);
  const attachment = active || request.nextUrl.searchParams.get("download") === "1";
  const range = attachment ? null : request.headers.get("range");

  let blob: Awaited<ReturnType<typeof readBlob>>;
  try {
    blob = await readBlob(file.pathname, range);
  } catch (error) {
    console.error(`[quotes] couldn't read ${file.pathname}`, error);
    return new Response("File storage is unavailable. Try again shortly.", {
      status: 503,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  if (!blob || blob.statusCode !== 200) return notFoundResponse();

  const headers = fileHeaders(
    active ? "application/octet-stream" : file.contentType,
    contentDisposition(attachment ? "attachment" : "inline", file.name),
  );
  headers.set("Accept-Ranges", "bytes");
  const length = blob.headers.get("content-length");
  if (length) headers.set("Content-Length", length);
  const contentRange = blob.headers.get("content-range");
  if (contentRange) headers.set("Content-Range", contentRange);

  return new Response(blob.stream, { status: contentRange ? 206 : 200, headers });
}
