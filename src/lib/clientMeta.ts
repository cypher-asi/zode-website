import "server-only";
import { headers } from "next/headers";

/** The requester's IP and user agent, for audit trails and signature records. */
export async function clientMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  const list = await headers();
  // Vercel sets x-real-ip itself; x-forwarded-for's first entry is client-supplied on other hosts.
  const forwarded = list.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: list.get("x-real-ip") || forwarded || null,
    userAgent: list.get("user-agent")?.slice(0, 400) || null,
  };
}
