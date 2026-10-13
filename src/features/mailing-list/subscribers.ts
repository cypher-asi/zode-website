import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Account } from "@/features/account/zos";
import { isUuid, normalizeEmail } from "@/features/data-room/rooms";
import { db } from "@/lib/db";
import { siteOrigin } from "@/lib/site";
import { SOURCES, type MailingList, type Subscriber, type SubscriberStatus } from "./types";

const CONFIRM_TTL_DAYS = 7;

const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

/** Where a confirmation link points; only the emailed copy of the token exists, the database keeps its hash. */
export const confirmUrl = (token: string): string => `${siteOrigin()}/mailing-list/confirm/${token}`;

function unsubscribeSignature(id: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not configured");
  return createHmac("sha256", secret).update(`unsubscribe:${id}`).digest("base64url");
}

/** A link that unsubscribes one row, good for as long as the row exists; for the footer of every list email. */
export const unsubscribeUrl = (id: string): string =>
  `${siteOrigin()}/mailing-list/unsubscribe?id=${id}&sig=${unsubscribeSignature(id)}`;

export function verifyUnsubscribe(id: unknown, sig: unknown): id is string {
  if (!isUuid(id) || typeof sig !== "string") return false;
  const expected = Buffer.from(unsubscribeSignature(id));
  const provided = Buffer.from(sig);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

const toSubscriber = (row: Record<string, unknown>): Subscriber => ({
  id: String(row.id),
  list: row.list as MailingList,
  email: String(row.email),
  name: row.name == null ? null : String(row.name),
  status: row.status as SubscriberStatus,
  source: row.source == null ? null : String(row.source),
  userId: row.user_id == null ? null : String(row.user_id),
  accountName: row.account_name == null ? null : String(row.account_name),
  createdAt: new Date(row.created_at as string | Date),
  confirmedAt: row.confirmed_at == null ? null : new Date(row.confirmed_at as string | Date),
  unsubscribedAt: row.unsubscribed_at == null ? null : new Date(row.unsubscribed_at as string | Date),
});

export interface SignUp {
  list: MailingList;
  email: string;
  name: string | null;
  source: string | null;
  account: Account | null;
  ip: string | null;
  userAgent: string | null;
}

export interface PendingConfirmation {
  email: string;
  name: string | null;
  token: string;
}

/**
 * Starts (or restarts) a sign-up to one list with a fresh confirmation token.
 * Returns `null` when the email is already subscribed to it, so no email is
 * sent. The row is linked to the signed-in account only when the email is
 * that account's own.
 */
export async function requestSubscription(signUp: SignUp): Promise<PendingConfirmation | null> {
  const email = normalizeEmail(signUp.email);
  const userId = signUp.account && normalizeEmail(signUp.account.email) === email ? signUp.account.userId : null;
  const source = SOURCES.includes(signUp.source as (typeof SOURCES)[number]) ? signUp.source : null;
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + CONFIRM_TTL_DAYS * 24 * 60 * 60 * 1000);

  const [row] = await db()`
    insert into mailing_list_subscribers
      (list, email, name, source, user_id, confirm_token_hash, confirm_expires_at, ip, user_agent)
    values
      (${signUp.list}, ${email}, ${signUp.name}, ${source}, ${userId}, ${hashToken(token)}, ${expiresAt}, ${signUp.ip}, ${signUp.userAgent})
    on conflict (list, email) do update set
      name = coalesce(excluded.name, mailing_list_subscribers.name),
      user_id = coalesce(mailing_list_subscribers.user_id, excluded.user_id),
      status = case when mailing_list_subscribers.status = 'subscribed' then 'subscribed' else 'pending' end,
      source = case when mailing_list_subscribers.status = 'subscribed' then mailing_list_subscribers.source else excluded.source end,
      confirm_token_hash = case when mailing_list_subscribers.status = 'subscribed' then null else excluded.confirm_token_hash end,
      confirm_expires_at = case when mailing_list_subscribers.status = 'subscribed' then null else excluded.confirm_expires_at end,
      ip = case when mailing_list_subscribers.status = 'subscribed' then mailing_list_subscribers.ip else excluded.ip end,
      user_agent = case when mailing_list_subscribers.status = 'subscribed' then mailing_list_subscribers.user_agent else excluded.user_agent end,
      updated_at = now()
    returning status, name, confirm_token_hash
  `;
  if (row.status === "subscribed" || !row.confirm_token_hash) return null;
  return { email, name: row.name == null ? null : String(row.name), token };
}

export interface PendingLookup {
  email: string;
  /** Usually one; a sign-up from before the lists split confirms both. */
  lists: MailingList[];
  expired: boolean;
}

/** What a confirmation link refers to, or `null` when it isn't (or is no longer) a live token. */
export async function findConfirmation(token: string): Promise<PendingLookup | null> {
  if (!token || token.length > 100) return null;
  const rows = await db()`
    select email, list, confirm_expires_at from mailing_list_subscribers
    where confirm_token_hash = ${hashToken(token)}
    order by list desc
  `;
  if (!rows.length) return null;
  return {
    email: String(rows[0].email),
    lists: rows.map((row) => row.list as MailingList),
    expired: new Date(rows[0].confirm_expires_at as string | Date).getTime() < Date.now(),
  };
}

/** Confirms the sign-up a link belongs to; the token is spent. Returns the email, or `null` if the link is dead. */
export async function confirmSubscription(token: string): Promise<string | null> {
  if (!token || token.length > 100) return null;
  const [row] = await db()`
    update mailing_list_subscribers set
      status = 'subscribed',
      confirmed_at = now(),
      unsubscribed_at = null,
      confirm_token_hash = null,
      confirm_expires_at = null,
      updated_at = now()
    where confirm_token_hash = ${hashToken(token)} and confirm_expires_at > now()
    returning email
  `;
  return row ? String(row.email) : null;
}

export async function unsubscribe(id: string): Promise<string | null> {
  if (!isUuid(id)) return null;
  const [row] = await db()`
    update mailing_list_subscribers set
      status = 'unsubscribed',
      unsubscribed_at = case when status = 'unsubscribed' then unsubscribed_at else now() end,
      confirm_token_hash = null,
      confirm_expires_at = null,
      updated_at = now()
    where id = ${id}
    returning email
  `;
  return row ? String(row.email) : null;
}

export async function getEmail(
  id: string,
): Promise<{ email: string; list: MailingList; status: SubscriberStatus } | null> {
  if (!isUuid(id)) return null;
  const [row] = await db()`select email, list, status from mailing_list_subscribers where id = ${id}`;
  return row
    ? { email: String(row.email), list: row.list as MailingList, status: row.status as SubscriberStatus }
    : null;
}

/** The account's own row on each list it has one on: linked to it, or under its email. */
export async function subscriptionsFor(account: Account): Promise<Subscriber[]> {
  const rows = await db()`
    select distinct on (s.list) s.*, null as account_name from mailing_list_subscribers s
    where s.user_id = ${account.userId} or s.email = ${normalizeEmail(account.email)}
    order by s.list, (s.email = ${normalizeEmail(account.email)}) desc
  `;
  return rows.map(toSubscriber);
}

/** Every row, or one list's, newest first, with linked accounts' current names. For ZODE admins only. */
export async function listSubscribers(list: MailingList | null = null): Promise<Subscriber[]> {
  const rows = await db()`
    select s.id, s.list, s.email, s.name, s.status, s.source, s.user_id, s.created_at, s.confirmed_at,
      s.unsubscribed_at, p.display_name as account_name
    from mailing_list_subscribers s
    left join account_profiles p on p.user_id = s.user_id
    where ${list}::text is null or s.list = ${list}
    order by s.created_at desc, s.list desc
  `;
  return rows.map(toSubscriber);
}
