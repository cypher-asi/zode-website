import "server-only";
import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { getAccount } from "@/features/account/session";
import type { Account } from "@/features/account/zos";
import { cleanPath, isBotAgent, optedOut } from "./classify";
import { analyticsEnabled, recordEvent, requestContext, validUuid, viewerOf } from "./collect";
import { SESSION_COOKIE, VISITOR_COOKIE } from "./definitions";
import type { AnalyticsEvent, EventProps } from "./events";

/** The page the action was sent from, by its Referer, when that's this site. */
function pagePath(referer: string | null, host: string | null): string {
  if (!referer) return "/";
  try {
    const url = new URL(referer);
    return (url.host === host && cleanPath(url.pathname)) || "/";
  } catch {
    return "/";
  }
}

/**
 * Records a conversion from a server action, after the response, attributed
 * to the visitor's session so it counts toward the source they came from.
 * Done on the server so ad blockers can't hide it. `account` is for actions
 * that sign the visitor in, whose session cookie isn't readable yet.
 */
export async function trackServerEvent(name: AnalyticsEvent, props: EventProps = {}, account?: Account): Promise<void> {
  if (!analyticsEnabled()) return;
  try {
    const [list, jar] = await Promise.all([headers(), cookies()]);
    if (optedOut(list) || isBotAgent(list.get("user-agent"))) return;
    const visit = {
      visitorId: validUuid(jar.get(VISITOR_COOKIE)?.value) ?? randomUUID(),
      sessionId: validUuid(jar.get(SESSION_COOKIE)?.value) ?? randomUUID(),
    };
    const path = pagePath(list.get("referer"), list.get("host"));
    const context = requestContext(list);
    const viewer = await viewerOf(account ?? (await getAccount()));
    after(() =>
      recordEvent(visit, context, viewer, { name, path, props }).catch((error: unknown) =>
        console.error(`[analytics] couldn't record ${name}`, error),
      ),
    );
  } catch (error) {
    console.error(`[analytics] couldn't track ${name}`, error);
  }
}
