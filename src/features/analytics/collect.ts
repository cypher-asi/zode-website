import "server-only";
import { userAgentFromString } from "next/server";
import { isTeam } from "@/features/account/admin";
import type { Account } from "@/features/account/zos";
import { homeDb } from "@/lib/db";
import { areaOf, classifyChannel, classifyPath, parseReferrer } from "./classify";
import { MAX_ENGAGED_MS } from "./definitions";
import type { AnalyticsEvent, EventProps } from "./events";

/**
 * Production records everything; local development only with ANALYTICS_DEV=1.
 * Each Vercel deployment migrates its own Neon branch, so previews never write
 * into production's analytics.
 */
export function analyticsEnabled(): boolean {
  return process.env.NODE_ENV === "production" || process.env.ANALYTICS_DEV === "1";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const validUuid = (value: unknown): string | null =>
  typeof value === "string" && UUID_RE.test(value) ? value.toLowerCase() : null;

export interface Visit {
  visitorId: string;
  sessionId: string;
}

/** Who is browsing, when they're signed in. */
export interface Viewer {
  zosUserId: string;
  team: boolean;
}

export async function viewerOf(account: Account | null): Promise<Viewer | null> {
  return account ? { zosUserId: account.userId, team: await isTeam(account) } : null;
}

/** What the request itself says about the visitor: where they are and what they browse with. */
export interface Context {
  country: string | null;
  region: string | null;
  city: string | null;
  device: string;
  browser: string | null;
  os: string | null;
  language: string | null;
}

const header = (value: string | null, max: number): string | null => {
  if (!value) return null;
  try {
    return decodeURIComponent(value).slice(0, max) || null;
  } catch {
    return null;
  }
};

/** Location comes from Vercel's edge headers; elsewhere it's left unknown. */
export function requestContext(headers: Headers): Context {
  const ua = userAgentFromString(headers.get("user-agent") ?? undefined);
  const type = ua.device.type;
  const country = header(headers.get("x-vercel-ip-country"), 2)?.toUpperCase() ?? null;
  const region = header(headers.get("x-vercel-ip-country-region"), 10);
  return {
    country,
    region: country && region ? `${country}-${region.toUpperCase()}` : null,
    city: header(headers.get("x-vercel-ip-city"), 100),
    device: type === "mobile" ? "Mobile" : type === "tablet" ? "Tablet" : type ? "Other" : "Desktop",
    browser: ua.browser.name?.slice(0, 50) ?? null,
    os: ua.os.name?.slice(0, 50) ?? null,
    language: headers.get("accept-language")?.split(",")[0]?.split(";")[0]?.trim().slice(0, 20) || null,
  };
}

export interface Utm {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
}

interface Source {
  channel: string | null;
  referrer_host: string | null;
  referrer_path: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
}

const NO_SOURCE: Source = {
  channel: null,
  referrer_host: null,
  referrer_path: null,
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_content: null,
  utm_term: null,
};

/**
 * The session's source, from its first pageview, and whether this visitor has
 * been seen as the ZODE team before. A session keeps the source it arrived
 * with, so every row in it can be filtered by channel or campaign.
 */
async function priorOf(visit: Visit): Promise<{ source: Source | null; team: boolean }> {
  const [sources, team] = await Promise.all([
    homeDb()`
      select channel, referrer_host, referrer_path, utm_source, utm_medium, utm_campaign, utm_content, utm_term
      from analytics_events
      where session_id = ${visit.sessionId} and kind = 'pageview'
      order by created_at
      limit 1
    `,
    homeDb()`select exists (select 1 from analytics_events where visitor_id = ${visit.visitorId} and is_team) as team`,
  ]);
  return { source: (sources[0] as Source | undefined) ?? null, team: Boolean(team[0]?.team) };
}

interface Row {
  kind: "pageview" | "event";
  name: string;
  pageviewId: string | null;
  path: string;
  title: string | null;
  screenWidth: number | null;
  language: string | null;
  props: EventProps;
}

async function insert(visit: Visit, context: Context, viewer: Viewer | null, row: Row, arrival: Source): Promise<void> {
  const prior = await priorOf(visit);
  const source = prior.source ?? arrival;
  const team = Boolean(viewer?.team) || prior.team;
  const { path, route } = classifyPath(row.path);
  const sql = homeDb();
  await sql`
    insert into analytics_events (
      kind, name, pageview_id, visitor_id, session_id, user_id, is_team, area, path, route, title,
      channel, referrer_host, referrer_path, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      country, region, city, device, browser, os, screen_width, language, props
    ) values (
      ${row.kind}, ${row.name}, ${row.pageviewId}, ${visit.visitorId}, ${visit.sessionId},
      (select id from users where zos_user_id = ${viewer?.zosUserId ?? null}), ${team},
      ${areaOf(path)}, ${path}, ${route}, ${row.title},
      ${source.channel}, ${source.referrer_host}, ${source.referrer_path},
      ${source.utm_source}, ${source.utm_medium}, ${source.utm_campaign}, ${source.utm_content}, ${source.utm_term},
      ${context.country}, ${context.region}, ${context.city}, ${context.device}, ${context.browser}, ${context.os},
      ${row.screenWidth}, ${row.language ?? context.language}, ${JSON.stringify(row.props)}::jsonb
    )
    on conflict (pageview_id) do nothing
  `;
  // A team member's first signed-in visit also marks what they browsed before signing in.
  if (viewer?.team && !prior.team) {
    await sql`update analytics_events set is_team = true where visitor_id = ${visit.visitorId} and not is_team`;
  }
}

export interface PageviewInput {
  pageviewId: string;
  path: string;
  title: string | null;
  referrer: string | null;
  utm: Utm;
  screenWidth: number | null;
  language: string | null;
}

export async function recordPageview(
  visit: Visit,
  context: Context,
  viewer: Viewer | null,
  input: PageviewInput,
  ownHost: string | null,
): Promise<void> {
  const referrer = parseReferrer(input.referrer, ownHost);
  const arrival: Source = {
    channel: classifyChannel(referrer.host, input.utm),
    referrer_host: referrer.host,
    referrer_path: referrer.path,
    utm_source: input.utm.source,
    utm_medium: input.utm.medium,
    utm_campaign: input.utm.campaign,
    utm_content: input.utm.content,
    utm_term: input.utm.term,
  };
  await insert(
    visit,
    context,
    viewer,
    {
      kind: "pageview",
      name: "pageview",
      pageviewId: input.pageviewId,
      path: input.path,
      title: input.title,
      screenWidth: input.screenWidth,
      language: input.language,
      props: {},
    },
    arrival,
  );
}

export async function recordEvent(
  visit: Visit,
  context: Context,
  viewer: Viewer | null,
  input: { name: AnalyticsEvent; path: string; props: EventProps },
): Promise<void> {
  await insert(
    visit,
    context,
    viewer,
    {
      kind: "event",
      name: input.name,
      pageviewId: null,
      path: input.path,
      title: null,
      screenWidth: null,
      language: null,
      props: input.props,
    },
    NO_SOURCE,
  );
}

/** The page's engaged time and scroll depth so far; they only grow, so a late beacon can't undo an earlier one. */
export async function recordEngagement(visit: Visit, pageviewId: string, engagedMs: number, scrollPct: number): Promise<void> {
  const ms = Math.min(Math.max(Math.round(engagedMs), 0), MAX_ENGAGED_MS);
  const scroll = Math.min(Math.max(Math.round(scrollPct), 0), 100);
  await homeDb()`
    update analytics_events
    set engaged_ms = greatest(engaged_ms, ${ms}), scroll_pct = greatest(scroll_pct, ${scroll})
    where pageview_id = ${pageviewId} and visitor_id = ${visit.visitorId}
  `;
}
