import "server-only";

const DEFAULT_ZOS_API_URL = "https://zosapi.zero.tech";
const DEFAULT_INVITE_CODE = "domw-jh4cz8";

/** A signed-in ZOS user, as kept in the account session cookie. */
export interface Account {
  userId: string;
  email: string;
  displayName: string;
  /** HTTP(S) avatar URL, or empty to fall back to initials. */
  profileImage: string;
  primaryZid: string;
}

export class ZosError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ZosError";
  }
}

interface ZosUser {
  id: string;
  email?: string;
  primaryEmail?: string;
  emailAddress?: string;
  profileSummary?: {
    firstName?: string;
    lastName?: string;
    profileImage?: string;
    primaryEmail?: string;
  };
  primaryZID?: string;
}

const baseUrl = () => process.env.ZOS_API_URL || DEFAULT_ZOS_API_URL;

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

async function zos<T>(path: string, init: { method?: string; token?: string; body?: unknown }): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.token) headers.Authorization = `Bearer ${init.token}`;

  const res = await fetch(`${baseUrl()}${path}`, {
    method: init.method ?? "POST",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let code = "";
    let message = text || res.statusText;
    try {
      const parsed = JSON.parse(text) as { code?: string; message?: string };
      code = parsed.code ?? "";
      message = parsed.message ?? message;
    } catch {
      // Non-JSON error body; keep the raw text.
    }
    throw new ZosError(res.status, code, message);
  }
  return (await res.json()) as T;
}

const fetchUser = (token: string) => zos<ZosUser>("/api/users/current", { method: "GET", token });

/**
 * ZOS returns avatars as Matrix content URIs (`mxc://server/media_id`), which
 * browsers can't load. Rewrite them to the homeserver's HTTP download URL.
 */
function resolveProfileImage(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  const match = /^mxc:\/\/([^/]+)\/(.+)$/.exec(value);
  return match ? `https://${match[1]}/_matrix/media/v3/download/${match[1]}/${match[2]}` : "";
}

function toAccount(user: ZosUser, fallbackEmail: string): Account {
  const profile = user.profileSummary;
  const fullName = `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim();
  return {
    userId: user.id,
    // ZOS just verified this address, so it stands in when the profile omits one.
    email: user.email ?? user.primaryEmail ?? user.emailAddress ?? profile?.primaryEmail ?? fallbackEmail,
    displayName: fullName || user.primaryZID || "User",
    profileImage: resolveProfileImage(profile?.profileImage),
    primaryZid: user.primaryZID ?? "",
  };
}

export async function zosLogin(email: string, password: string): Promise<Account> {
  const normalized = normalizeEmail(email);
  const { accessToken } = await zos<{ accessToken: string }>("/api/v2/accounts/login", {
    body: { email: normalized, password },
  });
  return toAccount(await fetchUser(accessToken), normalized);
}

/**
 * Creates a ZOS account, then finalizes its profile with the display name.
 * A blank invite code falls back to the configured default.
 */
export async function zosRegister(input: {
  name: string;
  email: string;
  password: string;
  inviteCode: string;
}): Promise<Account> {
  const email = normalizeEmail(input.email);
  const invite = input.inviteCode.trim() || process.env.ZOS_DEFAULT_INVITE_CODE || DEFAULT_INVITE_CODE;

  const { accessToken } = await zos<{ accessToken: string }>("/api/v2/accounts/createAndAuthorize", {
    body: { user: { email, password: input.password, handle: email }, inviteSlug: invite },
  });

  const created = await fetchUser(accessToken);
  try {
    await zos("/api/v2/accounts/finalize", {
      token: accessToken,
      body: { userId: created.id, name: input.name, inviteCode: invite },
    });
  } catch (error) {
    // The account exists either way; only the display name is missing.
    console.warn("ZOS finalize failed; continuing with session", error);
  }

  return toAccount(await fetchUser(accessToken), email);
}

/** A message safe to show in the login and register forms. */
export function describeZosError(error: unknown, fallback: string): string {
  if (!(error instanceof ZosError)) return fallback;
  if (error.code === "INVALID_EMAIL_PASSWORD" || error.status === 401) {
    return "Incorrect email or password.";
  }
  if (error.status >= 400 && error.status < 500 && error.message) return error.message;
  return fallback;
}
