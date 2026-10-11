/**
 * Readable-by-script companion to the HttpOnly `zode_account` cookie, set and
 * cleared with it. It carries no identity; it only lets statically rendered
 * pages show Logout instead of Login without a server round trip.
 */
export const SIGNED_IN_COOKIE = "zode_signed_in";

export function hasSignedInCookie(cookieHeader: string): boolean {
  return cookieHeader.split("; ").some((pair) => pair === `${SIGNED_IN_COOKIE}=1`);
}
