import "server-only";
import type { Account } from "./zos";

/**
 * ZODE staff who see every account's records in the portal: the ZOS user ids
 * in ZODE_ADMINS (comma separated). Ids rather than emails, because ZOS
 * registration is open and doesn't verify addresses. Unset makes everyone an
 * admin in local development only.
 */
export function isZodeAdmin(account: Account): boolean {
  const admins = (process.env.ZODE_ADMINS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (!admins.length) return process.env.NODE_ENV === "development";
  return admins.includes(account.userId);
}
