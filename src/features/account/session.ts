import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { homeDb } from "@/lib/db";
import { SITE_URL } from "@/lib/site";
import { recordAccount } from "./directory";
import { initials } from "./initials";
import { applyProfile, loadProfile } from "./profile";
import { REMEMBER_COOKIE } from "./rememberedAccounts";
import { SIGNED_IN_COOKIE } from "./signedInCookie";
import type { Account } from "./zos";

const ACCOUNT_COOKIE = "zode_account";
const ACCOUNT_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
/** Only needs to outlive the redirect after signing in, when the browser moves it into localStorage. */
const REMEMBER_MAX_AGE_SECONDS = 5 * 60;

const COOKIE_OPTIONS = {
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: ACCOUNT_MAX_AGE_SECONDS,
} as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sign(payload: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not configured");
  }
  return createHmac("sha256", secret).update(`account:${payload}`).digest("base64url");
}

interface Session {
  sid: string;
  account: Account;
}

/**
 * Token shape: `<base64url(json)>.<hmac>`, where the JSON is the account plus
 * the `sid` of its `account_sessions` row and an `exp` in epoch seconds. The
 * ZOS access token is never stored, so the browser can't use the cookie
 * against ZOS directly.
 */
function encode({ sid, account }: Session, exp: number): string {
  const payload = Buffer.from(JSON.stringify({ ...account, sid, exp })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(token: string | undefined): Session | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;

  const payload = token.slice(0, dot);
  const provided = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(payload));
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  try {
    const { exp, sid, ...account } = JSON.parse(Buffer.from(payload, "base64url").toString()) as Account & {
      exp: number;
      sid: string;
    };
    if (typeof exp !== "number" || exp * 1000 < Date.now()) return null;
    if (typeof sid !== "string" || !UUID_RE.test(sid)) return null;
    return { sid, account };
  } catch {
    return null;
  }
}

export async function createAccountSession(account: Account): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + ACCOUNT_MAX_AGE_SECONDS;
  const [[row]] = await Promise.all([
    homeDb()`
      insert into account_sessions (user_id, expires_at) values (${account.userId}, ${new Date(exp * 1000)})
      returning id
    `,
    recordAccount(account),
  ]);

  const cookieStore = await cookies();
  cookieStore.set(ACCOUNT_COOKIE, encode({ sid: String(row.id), account }, exp), { ...COOKIE_OPTIONS, httpOnly: true });
  setProfileCookies(cookieStore, applyProfile(account, await loadProfile(account.userId)));
}

/** The script-readable cookies: initials for the header avatar, and the identity this device remembers. */
function setProfileCookies(cookieStore: Awaited<ReturnType<typeof cookies>>, account: Account): void {
  cookieStore.set(SIGNED_IN_COOKIE, initials(account.displayName), COOKIE_OPTIONS);
  cookieStore.set(
    REMEMBER_COOKIE,
    JSON.stringify({ email: account.email, name: account.displayName, image: account.profileImage }),
    { ...COOKIE_OPTIONS, maxAge: REMEMBER_MAX_AGE_SECONDS },
  );
}

/** Rewrites the script-readable cookies after a profile edit, so the header and remembered accounts catch up. */
export async function refreshProfileCookies(): Promise<void> {
  const cookieStore = await cookies();
  const session = decode(cookieStore.get(ACCOUNT_COOKIE)?.value);
  if (!session) return;
  setProfileCookies(cookieStore, applyProfile(session.account, await loadProfile(session.account.userId)));
}

/** Revokes the session server-side as well, so a copied cookie stops working too. */
export async function deleteAccountSession(): Promise<void> {
  const cookieStore = await cookies();
  const session = decode(cookieStore.get(ACCOUNT_COOKIE)?.value);
  cookieStore.delete(ACCOUNT_COOKIE);
  cookieStore.delete(SIGNED_IN_COOKIE);
  if (session) {
    await homeDb()`update account_sessions set revoked_at = now() where id = ${session.sid} and revoked_at is null`;
  }
}

/**
 * The signed-in ZOS account with the user's profile edits applied, or `null`.
 * A revoked or expired session row counts as signed out.
 */
export const getAccount = cache(async (): Promise<Account | null> => {
  const cookieStore = await cookies();
  const session = decode(cookieStore.get(ACCOUNT_COOKIE)?.value);
  if (!session) return null;
  try {
    const [[row], profile] = await Promise.all([
      homeDb()`
        select 1 from account_sessions
        where id = ${session.sid} and user_id = ${session.account.userId}
          and revoked_at is null and expires_at > now()
      `,
      loadProfile(session.account.userId),
    ]);
    return row ? applyProfile(session.account, profile) : null;
  } catch (error) {
    console.error("[session] lookup failed; treating as signed out", error);
    return null;
  }
});

/** The signed-in account; anyone else is sent to log in and brought back to `returnTo`. */
export async function requireAccount(returnTo: string): Promise<Account> {
  const account = await getAccount();
  if (!account) {
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }
  return account;
}

/**
 * `next` if it resolves to a path on this site, else the portal. Browsers drop
 * tabs and newlines from URLs and treat `\` as `/`, so those are refused
 * before the origin check rather than trusted to a prefix test.
 */
export function safeNext(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/") || /[\\\u0000-\u001f\u007f]/.test(next)) return "/portal";
  try {
    const url = new URL(next, SITE_URL);
    // Dot segments can normalize to a protocol-relative path, e.g. `/..//evil.com` -> `//evil.com`.
    if (url.origin !== new URL(SITE_URL).origin || url.pathname.startsWith("//")) return "/portal";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/portal";
  }
}
