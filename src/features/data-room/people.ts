import "server-only";
import { isZodeAdmin } from "@/features/account/admin";
import type { Account } from "@/features/account/zos";
import { db } from "@/lib/db";
import { normalizeEmail } from "./rooms";
import type { PersonSuggestion } from "./types";

const MAX_QUERY_LENGTH = 100;
const MAX_SUGGESTIONS = 8;

const escapeLike = (value: string): string => value.replace(/[\\%_]/g, "\\$&");

/**
 * People to suggest inviting to a room. ZODE admins search every account seen
 * signing in plus everyone ever invited to any room; anyone else only sees
 * people they invited themselves, so rooms don't leak who else is in them.
 * Matches email or name anywhere, email prefixes first, and leaves out the
 * signed-in user and anyone already in (or invited to) this room.
 */
export async function searchPeople(account: Account, roomId: string, rawQuery: string): Promise<PersonSuggestion[]> {
  const query = rawQuery.trim().toLowerCase().slice(0, MAX_QUERY_LENGTH);
  if (!query) return [];
  const self = normalizeEmail(account.email);
  const contains = `%${escapeLike(query)}%`;
  const prefix = `${escapeLike(query)}%`;
  const sql = db();

  const rows = isZodeAdmin(account)
    ? await sql`
        with candidates as (
          select lower(d.email) as email, coalesce(p.display_name, d.display_name) as name
          from account_directory d
          left join account_profiles p on p.user_id = d.user_id
          union all
          select distinct lower(email), null from data_room_members
        )
        select email, max(name) as name
        from candidates
        where email <> ${self}
          and email not in (select lower(email) from data_room_members where room_id = ${roomId})
          and (email like ${contains} or name ilike ${contains})
        group by email
        order by email like ${prefix} desc, email
        limit ${MAX_SUGGESTIONS}
      `
    : await sql`
        with mine as (
          select distinct lower(email) as email from data_room_members where lower(invited_by_email) = ${self}
        ),
        candidates as (
          select mine.email, (
            select coalesce(p.display_name, d.display_name)
            from account_directory d
            left join account_profiles p on p.user_id = d.user_id
            where lower(d.email) = mine.email
            order by d.last_seen_at desc
            limit 1
          ) as name
          from mine
        )
        select email, name
        from candidates
        where email <> ${self}
          and email not in (select lower(email) from data_room_members where room_id = ${roomId})
          and (email like ${contains} or name ilike ${contains})
        order by email like ${prefix} desc, email
        limit ${MAX_SUGGESTIONS}
      `;

  return rows.map((row) => ({ email: String(row.email), name: row.name == null ? null : String(row.name) }));
}
