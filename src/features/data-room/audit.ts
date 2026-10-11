import "server-only";
import { headers } from "next/headers";
import type { Account } from "@/features/account/zos";
import { db } from "@/lib/db";
import type { AuditAction, AuditEvent } from "./types";

export interface EventInput {
  roomId: string;
  account: Account;
  action: AuditAction;
  fileId?: string | null;
  detail?: Record<string, unknown>;
}

async function clientMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  const list = await headers();
  // Vercel sets x-real-ip itself; x-forwarded-for's first entry is client-supplied on other hosts.
  const forwarded = list.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: list.get("x-real-ip") || forwarded || null,
    userAgent: list.get("user-agent")?.slice(0, 400) || null,
  };
}

/** Appends to a room's audit trail, stamped with the requester's IP and user agent. */
export async function recordEvents(events: EventInput[]): Promise<void> {
  if (!events.length) return;
  const { ip, userAgent } = await clientMeta();
  await db()`
    insert into data_room_events (room_id, file_id, actor_user_id, actor_email, action, detail, ip, user_agent)
    select * from unnest(
      ${events.map((e) => e.roomId)}::uuid[],
      ${events.map((e) => e.fileId ?? null)}::uuid[],
      ${events.map((e) => e.account.userId)}::text[],
      ${events.map((e) => e.account.email.toLowerCase())}::text[],
      ${events.map((e) => e.action)}::text[],
      ${events.map((e) => JSON.stringify(e.detail ?? {}))}::jsonb[],
      ${events.map(() => ip)}::text[],
      ${events.map(() => userAgent)}::text[]
    )
  `;
}

export const recordEvent = (event: EventInput): Promise<void> => recordEvents([event]);

export interface EventFilters {
  action?: string;
  actor?: string;
  fileId?: string;
}

export const EVENTS_PAGE_SIZE = 100;

function whereClause(roomId: string, filters: EventFilters): { sql: string; params: unknown[] } {
  const params: unknown[] = [roomId];
  const clauses = ["room_id = $1"];
  if (filters.action) {
    params.push(filters.action);
    clauses.push(`action = $${params.length}`);
  }
  if (filters.actor) {
    params.push(filters.actor.toLowerCase());
    clauses.push(`actor_email = $${params.length}`);
  }
  if (filters.fileId) {
    params.push(filters.fileId);
    clauses.push(`file_id = $${params.length}`);
  }
  return { sql: clauses.join(" and "), params };
}

const toEvent = (row: Record<string, unknown>): AuditEvent => ({
  id: String(row.id),
  createdAt: new Date(row.created_at as string).toISOString(),
  actorEmail: String(row.actor_email),
  action: row.action as AuditAction,
  fileId: row.file_id == null ? null : String(row.file_id),
  detail: (row.detail ?? {}) as Record<string, unknown>,
  ip: row.ip == null ? null : String(row.ip),
});

/** One page of events, newest first. */
export async function listEvents(
  roomId: string,
  filters: EventFilters,
  page: number,
): Promise<{ events: AuditEvent[]; hasMore: boolean }> {
  const { sql, params } = whereClause(roomId, filters);
  const rows = await db().query(
    `select id, created_at, actor_email, action, file_id, detail, ip from data_room_events
     where ${sql} order by created_at desc, id desc
     limit ${EVENTS_PAGE_SIZE + 1} offset ${Math.max(0, page) * EVENTS_PAGE_SIZE}`,
    params,
  );
  return { events: rows.slice(0, EVENTS_PAGE_SIZE).map(toEvent), hasMore: rows.length > EVENTS_PAGE_SIZE };
}

/** Every matching event for the CSV export, newest first, capped so one request stays bounded. */
export async function exportEvents(
  roomId: string,
  filters: EventFilters,
): Promise<(AuditEvent & { userAgent: string | null })[]> {
  const { sql, params } = whereClause(roomId, filters);
  const rows = await db().query(
    `select id, created_at, actor_email, action, file_id, detail, ip, user_agent from data_room_events
     where ${sql} order by created_at desc, id desc limit 50000`,
    params,
  );
  return rows.map((row) => ({ ...toEvent(row), userAgent: row.user_agent == null ? null : String(row.user_agent) }));
}

/** Everyone who appears in a room's trail, for the actor filter. */
export async function listActors(roomId: string): Promise<string[]> {
  const rows = await db()`
    select distinct actor_email from data_room_events where room_id = ${roomId} order by actor_email
  `;
  return rows.map((row) => String(row.actor_email));
}
