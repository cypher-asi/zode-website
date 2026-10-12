import "server-only";
import { db } from "@/lib/db";
import type { Account } from "./zos";

/** Keeps the account's directory row current; a failure is logged rather than failing sign-in. */
export async function recordAccount(account: Account): Promise<void> {
  try {
    await db()`
      insert into account_directory (user_id, email, display_name, last_seen_at)
      values (${account.userId}, ${account.email.trim().toLowerCase()}, ${account.displayName}, now())
      on conflict (user_id) do update
        set email = excluded.email, display_name = excluded.display_name, last_seen_at = excluded.last_seen_at
    `;
  } catch (error) {
    console.error("[directory] couldn't record the account", error);
  }
}
