/**
 * Readable-by-script companion to the HttpOnly `zode_account` cookie, set and
 * cleared with it. It carries only the account's initials, so statically
 * rendered pages can show Logout instead of Login, and the header avatar,
 * without a server round trip.
 */
export const SIGNED_IN_COOKIE = "zode_signed_in";

/** Sessions created before the cookie carried initials hold this value. */
const LEGACY_VALUE = "1";

/** The signed-in account's initials (empty for older sessions), or `null` when signed out. */
export function readSignedInCookie(cookieHeader: string): string | null {
  const prefix = `${SIGNED_IN_COOKIE}=`;
  const pair = cookieHeader.split("; ").find((entry) => entry.startsWith(prefix));
  if (pair === undefined) return null;
  const raw = pair.slice(prefix.length);
  if (raw === LEGACY_VALUE) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return "";
  }
}
