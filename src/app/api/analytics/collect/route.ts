import { randomUUID } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { getAccount } from "@/features/account/session";
import { cleanPath, isBotAgent, isUntracked, optedOut } from "@/features/analytics/classify";
import {
  analyticsEnabled,
  recordEngagement,
  recordEvent,
  recordPageview,
  requestContext,
  validUuid,
  viewerOf,
  type Utm,
} from "@/features/analytics/collect";
import {
  SESSION_COOKIE,
  SESSION_TIMEOUT_SECONDS,
  VISITOR_COOKIE,
  VISITOR_MAX_AGE_SECONDS,
} from "@/features/analytics/definitions";
import { cleanProps, isClientEvent } from "@/features/analytics/events";
import { clientIp, withinLimits } from "@/lib/rateLimit";

const MAX_BODY_BYTES = 4096;

const text = (value: unknown, max: number): string | null =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

function utmOf(value: unknown): Utm {
  const utm = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    source: text(utm.source, 100)?.toLowerCase() ?? null,
    medium: text(utm.medium, 100)?.toLowerCase() ?? null,
    campaign: text(utm.campaign, 150),
    content: text(utm.content, 150),
    term: text(utm.term, 150),
  };
}

const noContent = () => new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });

/**
 * The tracker's beacon: `pageview`, `event` (browser-safe events only) and
 * `engage` updates. Answers at once with the visitor and session cookies,
 * then records after the response. Bots, other sites and browsers that ask
 * not to be tracked get the same empty answer and nothing is stored.
 */
export async function POST(request: NextRequest) {
  if (!analyticsEnabled() || optedOut(request.headers) || isBotAgent(request.headers.get("user-agent"))) {
    return noContent();
  }
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return noContent();

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return noContent();
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return noContent();
    body = parsed as Record<string, unknown>;
  } catch {
    return noContent();
  }

  const visit = {
    visitorId: validUuid(request.cookies.get(VISITOR_COOKIE)?.value) ?? randomUUID(),
    sessionId: validUuid(request.cookies.get(SESSION_COOKIE)?.value) ?? randomUUID(),
  };
  const path = cleanPath(body.path);
  const pageviewId = validUuid(body.id);
  const response = noContent();

  const cookie = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" } as const;
  response.cookies.set(VISITOR_COOKIE, visit.visitorId, { ...cookie, maxAge: VISITOR_MAX_AGE_SECONDS });
  response.cookies.set(SESSION_COOKIE, visit.sessionId, { ...cookie, maxAge: SESSION_TIMEOUT_SECONDS });

  if (body.t === "engage") {
    if (!pageviewId) return response;
    const engagedMs = Number(body.ms) || 0;
    const scrollPct = Number(body.scroll) || 0;
    after(() =>
      recordEngagement(visit, pageviewId, engagedMs, scrollPct).catch((error: unknown) =>
        console.error("[analytics] couldn't record engagement", error),
      ),
    );
    return response;
  }

  if (!path || isUntracked(path)) return response;
  if (body.t !== "pageview" && !(body.t === "event" && isClientEvent(body.name))) return response;
  if (body.t === "pageview" && !pageviewId) return response;

  const context = requestContext(request.headers);
  const viewer = await viewerOf(await getAccount());
  const ownHost = request.headers.get("host")?.split(":")[0] ?? null;

  after(async () => {
    const ip = await clientIp();
    if (!(await withinLimits([{ key: `analytics:ip:${ip}`, max: 600, windowSeconds: 10 * 60 }]))) return;
    try {
      if (body.t === "pageview") {
        const width = Number(body.w);
        await recordPageview(
          visit,
          context,
          viewer,
          {
            pageviewId: pageviewId!,
            path,
            title: text(body.title, 300),
            referrer: text(body.ref, 1000),
            utm: utmOf(body.utm),
            screenWidth: Number.isInteger(width) && width > 0 && width < 20000 ? width : null,
            language: text(body.lang, 20),
          },
          ownHost,
        );
      } else if (isClientEvent(body.name)) {
        await recordEvent(visit, context, viewer, { name: body.name, path, props: cleanProps(body.props) });
      }
    } catch (error) {
      console.error(`[analytics] couldn't record ${String(body.t)}`, error);
    }
  });
  return response;
}
