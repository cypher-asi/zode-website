/**
 * Readable-by-script companion to the HttpOnly `zode_account` cookie, set and
 * cleared with it. It carries only the account's initials, so statically
 * rendered pages can show Logout instead of Login, and the header avatar,
 * without a server round trip.
 */
export const SIGNED_IN_COOKIE = "zode_signed_in";

/** Sessions created before the cookie carried initials hold this value. */
const LEGACY_VALUE = "1";

/**
 * Marks `<html>` for the header avatar, which CSS shows from the first paint:
 * `data-signed-in` is "initials" or "legacy" (no initials, so a glyph), and
 * `--account-initials` holds the initials as a CSS string for `content`.
 */
export function markSignedIn(initials: string | null): void {
  const root = document.documentElement;
  if (initials === null) {
    delete root.dataset.signedIn;
  } else {
    root.dataset.signedIn = initials ? "initials" : "legacy";
  }
  if (initials) {
    root.style.setProperty("--account-initials", `"${initials.replace(/["\\]/g, "\\$&")}"`);
  } else {
    root.style.removeProperty("--account-initials");
  }
}

/**
 * `markSignedIn(readSignedInCookie(document.cookie))` as an inline script for
 * `<head>`, so a reload paints the avatar in place instead of it popping in
 * at hydration and shifting the header.
 */
export const MARK_SIGNED_IN_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${SIGNED_IN_COOKIE}=([^;]*)/);if(!m)return;var v=m[1]===${JSON.stringify(LEGACY_VALUE)}?"":decodeURIComponent(m[1]);var r=document.documentElement;r.dataset.signedIn=v?"initials":"legacy";if(v)r.style.setProperty("--account-initials",'"'+v.replace(/["\\\\]/g,"\\\\$&")+'"')}catch(e){}})()`;

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
