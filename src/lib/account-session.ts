import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Account } from "./zos";

export const ACCOUNT_COOKIE = "zode_account";
const ACCOUNT_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function sign(payload: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not configured");
  }
  return createHmac("sha256", secret).update(`account:${payload}`).digest("base64url");
}

/**
 * Token shape: `<base64url(json)>.<hmac>`, where the JSON is the account plus
 * an `exp` in epoch seconds. The ZOS access token is never stored, so the
 * browser can't use the cookie against ZOS directly.
 */
function encode(account: Account): string {
  const exp = Math.floor(Date.now() / 1000) + ACCOUNT_MAX_AGE_SECONDS;
  const payload = Buffer.from(JSON.stringify({ ...account, exp })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(token: string | undefined): Account | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;

  const payload = token.slice(0, dot);
  const provided = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(payload));
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  try {
    const { exp, ...account } = JSON.parse(Buffer.from(payload, "base64url").toString()) as Account & {
      exp: number;
    };
    if (typeof exp !== "number" || exp * 1000 < Date.now()) return null;
    return account;
  } catch {
    return null;
  }
}

export async function createAccountSession(account: Account): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACCOUNT_COOKIE, encode(account), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCOUNT_MAX_AGE_SECONDS,
  });
}

export async function deleteAccountSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACCOUNT_COOKIE);
}

/** The signed-in ZOS account, or `null`. */
export const getAccount = cache(async (): Promise<Account | null> => {
  const cookieStore = await cookies();
  return decode(cookieStore.get(ACCOUNT_COOKIE)?.value);
});

/** The signed-in account; anyone else is sent to log in and brought back to `returnTo`. */
export async function requireAccount(returnTo: string): Promise<Account> {
  const account = await getAccount();
  if (!account) {
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }
  return account;
}

/** `next` if it's a same-site path, else the portal. */
export function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : "/portal";
}
