import { isZodeAdmin } from "@/features/account/admin";
import { getAccount } from "@/features/account/session";
import { getContractFile } from "@/features/contracts/contracts";
import { readBlob } from "@/features/data-room/blob";
import { contentDisposition, fileHeaders, notFoundResponse } from "@/features/data-room/http";
import { executedFileName } from "@/features/mnda/agreement";

/** Downloads an executed agreement for the account that signed it, or for any ZODE admin. */
export async function GET(_request: Request, ctx: RouteContext<"/api/contracts/[contractId]/pdf">) {
  const { contractId } = await ctx.params;
  const account = await getAccount();
  if (!account) return notFoundResponse();
  const file = await getContractFile(contractId);
  if (!file || (file.userId !== account.userId && !isZodeAdmin(account))) return notFoundResponse();

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

  const headers = fileHeaders("application/pdf", contentDisposition("attachment", executedFileName(file.counterparty)));
  const length = blob.headers.get("content-length");
  if (length) headers.set("Content-Length", length);
  return new Response(blob.stream, { headers });
}
