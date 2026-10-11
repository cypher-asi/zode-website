/**
 * Accounts that have signed in on this device, kept in localStorage so the
 * login form can offer them again. Only who the account is, never a token or
 * password. The server hands each new sign-in over in the short-lived,
 * script-readable `zode_remember` cookie (see `RememberAccount`).
 */
export const REMEMBER_COOKIE = "zode_remember";

const STORAGE_KEY = "zode:accounts";
const MAX_ACCOUNTS = 5;

/** Fired on this tab when the list changes; other tabs get the `storage` event. */
export const ACCOUNTS_CHANGED = "zode:accounts-changed";

export interface RememberedAccount {
  email: string;
  name: string;
  /** HTTP(S) avatar URL, or empty to fall back to initials. */
  image: string;
  /** Epoch milliseconds of the last sign-in. */
  lastUsed: number;
}

export type RememberedIdentity = Omit<RememberedAccount, "lastUsed">;

const sameEmail = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

function toIdentity(value: unknown): RememberedIdentity | null {
  if (typeof value !== "object" || value === null) return null;
  const { email, name, image } = value as Record<string, unknown>;
  if (typeof email !== "string" || !email || email.length > 320) return null;
  return {
    email,
    name: typeof name === "string" ? name.slice(0, 120) : "",
    image: typeof image === "string" && /^https?:\/\//i.test(image) ? image : "",
  };
}

/** Parses the stored list, dropping anything malformed. */
export function parseAccounts(raw: string | null): RememberedAccount[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .flatMap((entry) => {
        const identity = toIdentity(entry);
        const lastUsed = (entry as { lastUsed?: unknown } | null)?.lastUsed;
        return identity ? [{ ...identity, lastUsed: typeof lastUsed === "number" ? lastUsed : 0 }] : [];
      })
      .sort((a, b) => b.lastUsed - a.lastUsed)
      .slice(0, MAX_ACCOUNTS);
  } catch {
    return [];
  }
}

/** The raw stored list, or `null` when storage is empty or unavailable (e.g. blocked by the browser). */
export function readStoredAccounts(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function write(accounts: RememberedAccount[]): void {
  try {
    if (accounts.length) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage is full or blocked; the account just isn't remembered.
  }
  window.dispatchEvent(new Event(ACCOUNTS_CHANGED));
}

/** Moves the account to the top of the list, keeping the most recent few. */
export function rememberAccount(identity: RememberedIdentity): void {
  const others = parseAccounts(readStoredAccounts()).filter((account) => !sameEmail(account.email, identity.email));
  write([{ ...identity, lastUsed: Date.now() }, ...others].slice(0, MAX_ACCOUNTS));
}

export function forgetAccount(email: string): void {
  write(parseAccounts(readStoredAccounts()).filter((account) => !sameEmail(account.email, email)));
}

/** The account handed over in the `zode_remember` cookie, or `null`. */
export function readRememberCookie(cookieHeader: string): RememberedIdentity | null {
  const prefix = `${REMEMBER_COOKIE}=`;
  const pair = cookieHeader.split("; ").find((entry) => entry.startsWith(prefix));
  if (pair === undefined) return null;
  try {
    return toIdentity(JSON.parse(decodeURIComponent(pair.slice(prefix.length))));
  } catch {
    return null;
  }
}

export function clearRememberCookie(): void {
  document.cookie = `${REMEMBER_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}
