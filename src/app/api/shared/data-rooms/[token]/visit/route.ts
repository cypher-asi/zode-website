import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isBotAgent } from "@/features/analytics/classify";
import { requestContext, validUuid } from "@/features/analytics/collect";
import { recordEvent } from "@/features/data-room/audit";
import {
  SHARE_VISITOR_COOKIE,
  SHARE_VISITOR_MAX_AGE_SECONDS,
  recordEngagement,
  roomByShareToken,
  shareAudit,
  startVisit,
} from "@/features/data-room/shareLinks";
import { clientMeta } from "@/lib/clientMeta";

const MAX_BODY_BYTES = 16 * 1024;

const noStore = { "Cache-Control": "private, no-store" };
const noContent = () => new NextResponse(null, { status: 204, headers: noStore });

/** `{ "Chrome", "macOS" }` reads "Chrome on macOS"; whichever is known, or the device type, otherwise. */
function deviceOf(context: ReturnType<typeof requestContext>): string {
  if (context.browser && context.os) return `${context.browser} on ${context.os}`;
  return context.browser ?? context.os ?? context.device;
}

/**
 * The shared room's tracker. An empty body starts or continues this browser's
 * visit, setting its cookie, and answers with the visit's id; `{ visit, ms,
 * files }` saves the visit's foreground time so far. Bots, other sites and
 * the room's own members get an empty answer and nothing is stored.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/shared/data-rooms/[token]/visit">) {
  const site = request.headers.get("sec-fetch-site");
  if ((site && site !== "same-origin") || isBotAgent(request.headers.get("user-agent"))) return noContent();
  const link = await roomByShareToken((await ctx.params).token);
  if (!link) return new NextResponse("Not found", { status: 404, headers: noStore });

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return noContent();
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    return noContent();
  }

  const cookieVisitor = validUuid(request.cookies.get(SHARE_VISITOR_COOKIE)?.value);

  if (body.visit !== undefined) {
    const visitId = validUuid(body.visit);
    if (!visitId || !cookieVisitor) return noContent();
    const files =
      body.files && typeof body.files === "object"
        ? Object.entries(body.files as Record<string, unknown>).flatMap(([id, ms]): [string, number][] =>
            typeof ms === "number" && Number.isFinite(ms) ? [[id.toLowerCase(), ms]] : [],
          )
        : [];
    const ms = typeof body.ms === "number" && Number.isFinite(body.ms) ? body.ms : 0;
    await recordEngagement(link, visitId, cookieVisitor, ms, files);
    return noContent();
  }

  const audit = await shareAudit(link);
  if (!audit.counted) return NextResponse.json({ visit: null }, { headers: noStore });

  const visitorId = cookieVisitor ?? randomUUID();
  const context = requestContext(request.headers);
  const { ip, userAgent } = await clientMeta();
  const visit = await startVisit(link.linkId, visitorId, {
    ip,
    userAgent,
    device: deviceOf(context),
    location: [context.city, context.country].filter(Boolean).join(", ") || null,
  });
  if (visit.created) {
    await recordEvent({ roomId: link.id, account: audit.actor, action: "share_visit", detail: audit.detail });
  }

  const response = NextResponse.json({ visit: visit.id }, { headers: noStore });
  response.cookies.set(SHARE_VISITOR_COOKIE, visitorId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SHARE_VISITOR_MAX_AGE_SECONDS,
  });
  return response;
}
