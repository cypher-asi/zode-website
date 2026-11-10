import "server-only";
import { db } from "@/lib/db";
import type { Account } from "./zos";

/**
 * Keeps the account's directory row current and gives a first-time account its
 * ZODE user id; a failure is logged rather than failing sign-in. Only a sign-in
 * through ZOS moves `signed_in_at`; a login code was sent on the strength of it.
 */
export async function recordAccount(account: Account, via: "zos" | "code"): Promise<void> {
  const sql = db();
  try {
    await Promise.all([
      sql`
        insert into account_directory
          (user_id, email, display_name, profile_image, primary_zid, last_seen_at, signed_in_at)
        values (
          ${account.userId}, ${account.email.trim().toLowerCase()}, ${account.displayName},
          ${account.profileImage}, ${account.primaryZid}, now(), ${via === "zos" ? new Date() : null}
        )
        on conflict (user_id) do update
          set email = excluded.email, display_name = excluded.display_name, profile_image = excluded.profile_image,
            primary_zid = excluded.primary_zid, last_seen_at = excluded.last_seen_at,
            signed_in_at = coalesce(excluded.signed_in_at, account_directory.signed_in_at)
      `,
      // `not exists` first, so a returning account doesn't spend an id; `on conflict` covers concurrent sign-ins.
      sql`
        insert into users (zos_user_id)
        select ${account.userId} where not exists (select 1 from users where zos_user_id = ${account.userId})
        on conflict (zos_user_id) do nothing
      `,
    ]);
  } catch (error) {
    console.error("[directory] couldn't record the account", error);
  }
}
