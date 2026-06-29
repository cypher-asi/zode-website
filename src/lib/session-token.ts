import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "grid_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/**
 * Temporary kill-switch for the shared-password gate. While `true`, every
 * page is publicly accessible and the login flow is bypassed. Flip back to
 * `false` to re-enable the password requirement.
 */
export const AUTH_DISABLED = true;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not configured");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

/**
 * Token shape: `<issuedAtMs>.<hmac>`. The HMAC covers the issuedAt
 * value so a tampered or forged cookie fails verification. No user
 * data is stored — this is a single shared-password gate.
 */
export function createSessionToken(): string {
  const issuedAt = String(Date.now());
  return `${issuedAt}.${sign(issuedAt)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;

  const issuedAt = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);
  if (!/^\d+$/.test(issuedAt)) return false;

  const provided = Buffer.from(providedSig);
  const expected = Buffer.from(sign(issuedAt));
  if (provided.length !== expected.length) return false;
  if (!timingSafeEqual(provided, expected)) return false;

  const ageMs = Date.now() - Number(issuedAt);
  return ageMs >= 0 && ageMs <= SESSION_MAX_AGE_SECONDS * 1000;
}

export function checkPassword(candidate: string): boolean {
  const expected = process.env.SITE_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
