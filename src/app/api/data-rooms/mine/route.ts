import { getAccount } from "@/features/account/session";
import { roomsVersion } from "@/features/data-room/invites";

/** A fingerprint of the signed-in account's rooms and invites, which an open portal polls to know when to refresh. */
export async function GET(): Promise<Response> {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Signed out" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return Response.json({ v: await roomsVersion(account) }, { headers: { "Cache-Control": "no-store" } });
}
