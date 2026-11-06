import "server-only";
import { randomBytes } from "node:crypto";
import { cache } from "react";
import { getAccount } from "@/features/account/session";
import type { Account } from "@/features/account/zos";
import { db } from "@/lib/db";
import { PUBLIC_LINK_EMAIL, type AuditActor } from "./audit";
import { isRoomMember, isUuid } from "./rooms";
import type { ShareLink, ShareLinkDetail } from "./types";

/** 32 random bytes, base64url, which is what a share link is. Anything else never matches a row. */
const SHARE_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

const isShareToken = (value: unknown): value is string => typeof value === "string" && SHARE_TOKEN_RE.test(value);

const newToken = (): string => randomBytes(32).toString("base64url");

/** The browser's id across visits to every share link, so a returning reader isn't a new device. */
export const SHARE_VISITOR_COOKIE = "zode_drv";
export const SHARE_VISITOR_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/** A visit's foreground time is capped here, so a tab left open in front doesn't count as reading. */
export const MAX_VISIT_MS = 4 * 60 * 60 * 1000;

const MAX_FILES_PER_BEAT = 200;

const iso = (value: unknown): string => new Date(value as string | Date).toISOString();

/** The room a share link opens, with the link; `id` and `name` are the room's. */
export interface SharedRoomLink {
  id: string;
  name: string;
  linkId: string;
  email: string | null;
}

/** Null when the token is unknown or the link was revoked. Cached per request, as the page and its metadata both ask. */
export const roomByShareToken = cache(async (token: string): Promise<SharedRoomLink | null> => {
  if (!isShareToken(token)) return null;
  const [row] = await db()`
    select r.id, r.name, l.id as link_id, l.email
    from data_room_share_links l
    join data_rooms r on r.id = l.room_id
    where l.token = ${token} and l.revoked_at is null
  `;
  return row
    ? {
        id: String(row.id),
        name: String(row.name),
        linkId: String(row.link_id),
        email: row.email == null ? null : String(row.email),
      }
    : null;
});

export interface ShareAudit {
  actor: Account | AuditActor;
  detail: Record<string, unknown>;
  /** False for the room's own members, whose use of a link isn't the recipient's. */
  counted: boolean;
}

/**
 * Who a request through a share link is audited as: the session when there is
 * one, otherwise the link's recipient. Its detail ties the event to the link,
 * except for room members, so an admin checking a link doesn't add to it.
 */
export async function shareAudit(link: SharedRoomLink): Promise<ShareAudit> {
  const account = await getAccount();
  const counted = !account || !(await isRoomMember(link.id, account.userId));
  return {
    actor: account ?? { userId: null, email: link.email ?? PUBLIC_LINK_EMAIL },
    detail: counted ? { via: "share-link", linkId: link.linkId } : { via: "share-link" },
    counted,
  };
}

/** A room's live links with what their recipients did: recipients newest first, then the room-wide link. */
export async function listShareLinks(roomId: string): Promise<ShareLink[]> {
  const rows = await db()`
    select l.id, l.email, l.token, l.created_by_email, l.created_at, l.sends,
      v.views, v.devices, v.engaged_ms, v.last_viewed_at, d.downloads
    from data_room_share_links l
    cross join lateral (
      select count(*)::int as views, count(distinct visitor_id)::int as devices,
        coalesce(sum(engaged_ms), 0)::bigint as engaged_ms, max(last_seen_at) as last_viewed_at
      from data_room_share_visits where link_id = l.id
    ) v
    cross join lateral (
      select count(distinct coalesce(e.file_id::text, e.detail->>'name'))::int as downloads
      from data_room_events e
      where e.detail ? 'linkId' and e.detail->>'linkId' = l.id::text and e.room_id = l.room_id and e.action = 'download'
    ) d
    where l.room_id = ${roomId} and l.revoked_at is null
    order by l.email is null, l.created_at desc
  `;
  return rows.map((row) => ({
    id: String(row.id),
    email: row.email == null ? null : String(row.email),
    token: String(row.token),
    createdBy: String(row.created_by_email),
    createdAt: iso(row.created_at),
    sends: Number(row.sends),
    views: Number(row.views),
    devices: Number(row.devices),
    engagedMs: Number(row.engaged_ms),
    downloads: Number(row.downloads),
    lastViewedAt: row.last_viewed_at == null ? null : iso(row.last_viewed_at),
  }));
}

export interface IssuedLink {
  id: string;
  email: string;
  token: string;
  created: boolean;
}

/** A live link for each address, reusing the one it already has. */
export async function issueShareLinks(roomId: string, emails: string[], byEmail: string): Promise<IssuedLink[]> {
  if (!emails.length) return [];
  const sql = db();
  const created = await sql`
    insert into data_room_share_links (room_id, email, token, created_by_email)
    select ${roomId}, x.email, x.token, ${byEmail}
    from unnest(${emails}::text[], ${emails.map(newToken)}::text[]) as x(email, token)
    on conflict (room_id, email) where revoked_at is null and email is not null do nothing
    returning id
  `;
  const fresh = new Set(created.map((row) => String(row.id)));
  const rows = await sql`
    select id, email, token from data_room_share_links
    where room_id = ${roomId} and revoked_at is null and email = any(${emails}::text[])
  `;
  const byAddress = new Map(rows.map((row) => [String(row.email), row]));
  return emails.flatMap((email) => {
    const row = byAddress.get(email);
    return row ? [{ id: String(row.id), email, token: String(row.token), created: fresh.has(String(row.id)) }] : [];
  });
}

/** Counts a send of a recipient's link and returns the count, or null when the link is gone. */
export async function countSend(roomId: string, linkId: string): Promise<{ email: string; token: string; sends: number } | null> {
  if (!isUuid(linkId)) return null;
  const [row] = await db()`
    update data_room_share_links set sends = sends + 1
    where id = ${linkId} and room_id = ${roomId} and revoked_at is null and email is not null
    returning email, token, sends
  `;
  return row ? { email: String(row.email), token: String(row.token), sends: Number(row.sends) } : null;
}

/** The revoked link's recipient, or undefined when it was already gone. */
export async function revokeShareLink(roomId: string, linkId: string): Promise<{ email: string | null } | undefined> {
  if (!isUuid(linkId)) return undefined;
  const [row] = await db()`
    update data_room_share_links set revoked_at = now()
    where id = ${linkId} and room_id = ${roomId} and revoked_at is null
    returning email
  `;
  return row ? { email: row.email == null ? null : String(row.email) } : undefined;
}

/** Each visit, the time spent on each file, and each file downloaded through the link. */
export async function shareLinkDetail(roomId: string, linkId: string): Promise<ShareLinkDetail | null> {
  if (!isUuid(linkId)) return null;
  const sql = db();
  const [link] = await sql`select 1 from data_room_share_links where id = ${linkId} and room_id = ${roomId}`;
  if (!link) return null;
  const [visits, files, downloads] = await Promise.all([
    sql`
      select id, started_at, engaged_ms, device, location, ip from data_room_share_visits
      where link_id = ${linkId} order by started_at desc limit 50
    `,
    sql`
      select t.file_id, f.name, f.deleted_at, sum(t.engaged_ms)::bigint as engaged_ms
      from data_room_share_file_time t
      join data_room_share_visits v on v.id = t.visit_id
      join data_room_files f on f.id = t.file_id
      where v.link_id = ${linkId}
      group by t.file_id, f.name, f.deleted_at
      order by engaged_ms desc
      limit 100
    `,
    sql`
      select e.file_id, max(e.detail->>'name') as name, count(*)::int as count, max(e.created_at) as last_at,
        bool_or(coalesce((e.detail->>'archive')::boolean, false)) as zipped
      from data_room_events e
      where e.detail ? 'linkId' and e.detail->>'linkId' = ${linkId} and e.room_id = ${roomId} and e.action = 'download'
      group by e.file_id
      order by last_at desc
      limit 100
    `,
  ]);
  return {
    visits: visits.map((row) => ({
      id: String(row.id),
      startedAt: iso(row.started_at),
      engagedMs: Number(row.engaged_ms),
      device: row.device == null ? null : String(row.device),
      location: row.location == null ? null : String(row.location),
      ip: row.ip == null ? null : String(row.ip),
    })),
    files: files.map((row) => ({
      fileId: String(row.file_id),
      name: String(row.name),
      engagedMs: Number(row.engaged_ms),
      live: row.deleted_at == null,
    })),
    downloads: downloads.map((row) => ({
      fileId: row.file_id == null ? null : String(row.file_id),
      name: String(row.name ?? "A deleted file"),
      count: Number(row.count),
      lastAt: iso(row.last_at),
      zipped: Boolean(row.zipped),
    })),
  };
}

export interface VisitMeta {
  ip: string | null;
  userAgent: string | null;
  device: string | null;
  location: string | null;
}

/** Continues the browser's visit when it was last seen within 30 minutes, otherwise starts one. */
export async function startVisit(linkId: string, visitorId: string, meta: VisitMeta): Promise<{ id: string; created: boolean }> {
  const [row] = await db()`
    with recent as (
      update data_room_share_visits set last_seen_at = now()
      where id = (
        select id from data_room_share_visits
        where link_id = ${linkId} and visitor_id = ${visitorId} and last_seen_at > now() - interval '30 minutes'
        order by last_seen_at desc
        limit 1
      )
      returning id, false as created
    ),
    started as (
      insert into data_room_share_visits (link_id, visitor_id, ip, user_agent, device, location)
      select ${linkId}, ${visitorId}, ${meta.ip}, ${meta.userAgent}, ${meta.device}, ${meta.location}
      where not exists (select 1 from recent)
      returning id, true as created
    )
    select id, created from recent union all select id, created from started
  `;
  return { id: String(row.id), created: Boolean(row.created) };
}

/**
 * Saves a visit's foreground time so far, in total and per file. The browser
 * sends running totals, so each only grows: a late or repeated beacon can't
 * add time. The visit must be this browser's, on this link.
 */
export async function recordEngagement(
  link: SharedRoomLink,
  visitId: string,
  visitorId: string,
  totalMs: number,
  files: [fileId: string, ms: number][],
): Promise<void> {
  const total = Math.min(Math.max(Math.round(totalMs), 0), MAX_VISIT_MS);
  const sql = db();
  const [visit] = await sql`
    update data_room_share_visits
    set engaged_ms = greatest(engaged_ms, ${total}), last_seen_at = now()
    where id = ${visitId} and link_id = ${link.linkId} and visitor_id = ${visitorId}
    returning id
  `;
  if (!visit) return;
  const valid = files.filter(([id, ms]) => isUuid(id) && ms > 0).slice(0, MAX_FILES_PER_BEAT);
  if (!valid.length) return;
  await sql`
    insert into data_room_share_file_time (visit_id, file_id, engaged_ms)
    select ${visitId}, f.id, x.ms
    from unnest(${valid.map(([id]) => id)}::uuid[], ${valid.map(([, ms]) => Math.min(Math.round(ms), total))}::int[]) as x(file_id, ms)
    join data_room_files f on f.id = x.file_id and f.room_id = ${link.id}
    on conflict (visit_id, file_id) do update set engaged_ms = greatest(data_room_share_file_time.engaged_ms, excluded.engaged_ms)
  `;
}
