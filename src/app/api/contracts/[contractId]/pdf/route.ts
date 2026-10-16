import type { NextRequest } from "next/server";
import { isTeam } from "@/features/account/admin";
import { getAccount } from "@/features/account/session";
import { contractFileName, getContractFile } from "@/features/contracts/contracts";
import { readBlob } from "@/features/data-room/blob";
import { contentDisposition, fileHeaders, notFoundResponse } from "@/features/data-room/http";

/**
 * Streams an executed agreement to the account that signed it, or to anyone
 * on the ZODE team: inline for the viewer, or as an attachment with
 * `?download=1`. A compute deal's `?doc=` names which of its PDFs.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/contracts/[contractId]/pdf">) {
  const { contractId } = await ctx.params;
  const account = await getAccount();
  if (!account) return notFoundResponse();
  const file = await getContractFile(contractId, request.nextUrl.searchParams.get("doc"));
  if (!file || (file.userId !== account.userId && !(await isTeam(account)))) return notFoundResponse();

  let blob: Awaited<ReturnType<typeof readBlob>>;
  try {
    blob = await readBlob(file.blobPathname, null);
  } catch (error) {
    console.error(`[contracts] couldn't read ${file.blobPathname}`, error);
    return new Response("File storage is unavailable. Try again shortly.", {
      status: 503,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  if (!blob || blob.statusCode !== 200) return notFoundResponse();

  const attachment = request.nextUrl.searchParams.get("download") === "1";
  const headers = fileHeaders(
    "application/pdf",
    contentDisposition(attachment ? "attachment" : "inline", contractFileName(file)),
  );
  const length = blob.headers.get("content-length");
  if (length) headers.set("Content-Length", length);
  return new Response(blob.stream, { headers });
}
