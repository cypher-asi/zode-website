import "server-only";
import { db } from "@/lib/db";
import type { User, UserRole } from "./types";

const toUser = (row: Record<string, unknown>): User => ({
  id: Number(row.id),
  zosUserId: String(row.zos_user_id),
  role: row.role as UserRole,
  email: row.email == null ? null : String(row.email),
  name: row.name == null ? null : String(row.name),
  lastSeenAt: row.last_seen_at == null ? null : new Date(row.last_seen_at as string | Date),
});

/** Every account by ZODE user id, with the name and email it last signed in with. For super admins only. */
export async function listUsers(): Promise<User[]> {
  const rows = await db()`
    select u.id, u.zos_user_id, u.role, d.email, coalesce(p.display_name, d.display_name) as name, d.last_seen_at
    from users u
    left join account_directory d on d.user_id = u.zos_user_id
    left join account_profiles p on p.user_id = u.zos_user_id
    order by u.id
  `;
  return rows.map(toUser);
}

/** The account's ZODE user id, or `null` before its first sign-in has been recorded. */
export async function userIdFor(zosUserId: string): Promise<number | null> {
  const [row] = await db()`select id from users where zos_user_id = ${zosUserId}`;
  return row ? Number(row.id) : null;
}

/** Sets a user's role, noting who changed it. Returns `false` when there's no such user. */
export async function setRole(userId: number, role: UserRole, actorZosUserId: string): Promise<boolean> {
  const rows = await db()`
    update users set
      role = ${role},
      role_updated_at = now(),
      role_updated_by = (select id from users where zos_user_id = ${actorZosUserId})
    where id = ${userId}
    returning id
  `;
  return rows.length > 0;
}
