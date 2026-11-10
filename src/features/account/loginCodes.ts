import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { db, homeDb } from "@/lib/db";
import type { Account } from "./zos";

export const LOGIN_CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

function hashCode(email: string, code: string): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not configured");
  return createHmac("sha256", secret).update(`login-code:${email}:${code}`).digest();
}

/** The account ZOS last signed in under this address, as ZOS described it then. */
async function directoryAccount(where: { email: string } | { userId: string }): Promise<Account | null> {
  const sql = db();
  const rows =
    "email" in where
      ? await sql`
          select user_id, email, display_name, profile_image, primary_zid from account_directory
          where lower(email) = ${where.email} and signed_in_at is not null
          order by signed_in_at desc
          limit 1
        `
      : await sql`
          select user_id, email, display_name, profile_image, primary_zid from account_directory
          where user_id = ${where.userId} and signed_in_at is not null
        `;
  const row = rows[0];
  if (!row) return null;
  const primaryZid = String(row.primary_zid ?? "");
  return {
    userId: String(row.user_id),
    email: String(row.email),
    displayName: String(row.display_name ?? "") || primaryZid || "User",
    profileImage: String(row.profile_image ?? ""),
    primaryZid,
  };
}

/**
 * Has `deliver` email a fresh code to an address that has signed in here
 * before, which then supersedes any earlier one; a failed delivery leaves the
 * earlier one working. False for an address this site doesn't know, which ZOS handles.
 */
export async function issueLoginCode(
  email: string,
  deliver: (code: string, id: string) => Promise<void>,
): Promise<boolean> {
  const address = normalizeEmail(email);
  const account = await directoryAccount({ email: address });
  if (!account) return false;

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const sql = homeDb();
  await sql`delete from login_codes where expires_at < now() - interval '1 day'`;
  const [row] = await sql`
    insert into login_codes (email, user_id, code_hash, expires_at)
    values (
      ${address}, ${account.userId}, ${hashCode(address, code).toString("hex")},
      now() + make_interval(mins => ${LOGIN_CODE_TTL_MINUTES})
    )
    returning id
  `;
  const id = String(row.id);
  try {
    await deliver(code, id);
  } catch (error) {
    await sql`delete from login_codes where id = ${id}`;
    throw error;
  }
  await sql`update login_codes set used_at = now() where email = ${address} and used_at is null and id <> ${id}`;
  return true;
}

export type LoginCodeResult = { status: "ok"; account: Account } | { status: "invalid" } | { status: "none" };

/**
 * Checks the address's latest live code. `none` means this site sent it no
 * code, so the code can only have come from ZOS.
 */
export async function redeemLoginCode(email: string, code: string): Promise<LoginCodeResult> {
  const address = normalizeEmail(email);
  const sql = homeDb();
  const [row] = await sql`
    update login_codes set attempts = attempts + 1
    where id = (
      select id from login_codes
      where email = ${address} and used_at is null and expires_at > now()
      order by created_at desc
      limit 1
    )
    returning id, user_id, code_hash, attempts
  `;
  if (!row) return { status: "none" };

  const expected = Buffer.from(String(row.code_hash), "hex");
  const given = hashCode(address, code);
  if (Number(row.attempts) > MAX_ATTEMPTS || !timingSafeEqual(expected, given)) return { status: "invalid" };

  const [used] = await sql`update login_codes set used_at = now() where id = ${row.id} and used_at is null returning id`;
  if (!used) return { status: "invalid" };

  const account = await directoryAccount({ userId: String(row.user_id) });
  return account ? { status: "ok", account } : { status: "invalid" };
}
