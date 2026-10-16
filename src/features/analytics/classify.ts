/**
 * Turns what a pageview reports into the dimensions the reports group by:
 * the page's route, the site's area, and the session's channel. Pure, so the
 * collector and the reports agree on every rule.
 */

export type Area = "site" | "portal" | "account";

export const AREAS: readonly { id: Area; label: string }[] = [
  { id: "site", label: "Site" },
  { id: "portal", label: "Portal" },
  { id: "account", label: "Sign-in & invites" },
];

export const CHANNELS = [
  "Direct",
  "Organic Search",
  "AI Assistants",
  "Paid",
  "Social",
  "Email",
  "Referral",
] as const;

export type Channel = (typeof CHANNELS)[number];

const MAX_PATH_LENGTH = 300;

/** Links that carry a secret: the path is stored as its route, so no token lands in the database. */
const SECRET_ROUTES: readonly (readonly [RegExp, string])[] = [
  [/^\/(team\/invite|invite|data-rooms\/invite|mailing-list\/confirm|shared\/deployments)\/[^/]+$/, "/$1/[token]"],
];

/** The app's dynamic routes, so every post or record is counted under one page. */
const DYNAMIC_ROUTES: readonly (readonly [RegExp, string])[] = [
  [/^\/news\/[^/]+$/, "/news/[slug]"],
  [/^\/changelog\/[^/]+$/, "/changelog/[slug]"],
  [/^\/portal\/data-rooms\/[^/]+(\/[^/]+)?$/, "/portal/data-rooms/[roomId]$1"],
  [/^\/portal\/deployments\/(?!all$|new$)[^/]+(\/edit)?$/, "/portal/deployments/[id]$1"],
  [/^\/portal\/posts\/(?!news$|changelog$)[^/]+(\/preview)?$/, "/portal/posts/[postId]$1"],
  [/^\/portal\/capacity\/sites\/(?!new$)[^/]+$/, "/portal/capacity/sites/[id]"],
  [/^\/portal\/zrm\/([^/]+)\/(?!new$)[^/]+$/, "/portal/zrm/$1/[id]"],
];

const UUID_SEGMENT = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi;

/** A pathname without its query, hash or trailing slash, or `null` if it isn't one. */
export function cleanPath(input: unknown): string | null {
  if (typeof input !== "string" || !input.startsWith("/") || input.startsWith("//")) return null;
  let path = input.split(/[?#]/, 1)[0];
  try {
    path = decodeURI(path);
  } catch {
    // Keep it encoded.
  }
  if (path.length > 1) path = path.replace(/\/+$/, "");
  return path.slice(0, MAX_PATH_LENGTH) || "/";
}

/** The page's path as stored, with secrets removed, and the route it's grouped under. */
export function classifyPath(path: string): { path: string; route: string } {
  for (const [pattern, route] of SECRET_ROUTES) {
    if (pattern.test(path)) {
      const redacted = path.replace(pattern, route);
      return { path: redacted, route: redacted };
    }
  }
  for (const [pattern, route] of DYNAMIC_ROUTES) {
    if (pattern.test(path)) return { path, route: path.replace(pattern, route) };
  }
  return { path, route: path.replace(UUID_SEGMENT, "/[id]") };
}

const ACCOUNT_PREFIXES = ["/login", "/register", "/invite", "/team/invite", "/data-rooms/invite", "/mailing-list"];

const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

export function areaOf(path: string): Area {
  if (under(path, "/portal")) return "portal";
  if (ACCOUNT_PREFIXES.some((prefix) => under(path, prefix))) return "account";
  return "site";
}

/** Pages that are never counted: development tools. */
export function isUntracked(path: string): boolean {
  return under(path, "/dev");
}

const hostIs = (host: string, domains: readonly string[]) =>
  domains.some((domain) => host === domain || host.endsWith(`.${domain}`));

const SEARCH = ["google", "bing.com", "duckduckgo.com", "yahoo.com", "baidu.com", "yandex.ru", "yandex.com", "ecosia.org", "search.brave.com", "startpage.com", "kagi.com", "qwant.com"];
const AI = ["chatgpt.com", "chat.openai.com", "perplexity.ai", "claude.ai", "gemini.google.com", "copilot.microsoft.com", "you.com", "phind.com", "grok.com"];
const SOCIAL = ["facebook.com", "fb.com", "instagram.com", "linkedin.com", "lnkd.in", "t.co", "twitter.com", "x.com", "reddit.com", "youtube.com", "youtu.be", "tiktok.com", "threads.net", "bsky.app", "mastodon.social", "discord.com", "telegram.org", "t.me", "whatsapp.com", "pinterest.com"];
const EMAIL = ["mail.google.com", "outlook.live.com", "outlook.office.com", "mail.yahoo.com", "mail.proton.me"];

/** Google's many country domains, e.g. google.co.uk, all count as search. */
const isGoogleSearch = (host: string) => /(^|\.)google\.[a-z.]+$/.test(host) && host !== "gemini.google.com" && !host.startsWith("mail.");

/**
 * The channel a session arrived through, from its UTM tags first, then its
 * referrer. No external referrer and no tags is Direct.
 */
export function classifyChannel(referrerHost: string | null, utm: { source?: string | null; medium?: string | null }): Channel {
  const medium = utm.medium?.toLowerCase() ?? "";
  const source = utm.source?.toLowerCase() ?? "";
  if (/^(cpc|ppc|paid|paidsearch|paid_social|paid-social|display|cpm|banner|retargeting)$/.test(medium)) return "Paid";
  if (/^(e-?mail|newsletter)$/.test(medium) || source === "newsletter") return "Email";
  if (/^(social|social-network|social-media|sm)$/.test(medium)) return "Social";

  const host = referrerHost ?? "";
  if (host && hostIs(host, AI)) return "AI Assistants";
  if (host && hostIs(host, EMAIL)) return "Email";
  if (host && (isGoogleSearch(host) || hostIs(host, SEARCH))) return "Organic Search";
  if (host && hostIs(host, SOCIAL)) return "Social";
  if (source) {
    if (hostIs(source, AI) || /chatgpt|perplexity|claude|gemini|copilot/.test(source)) return "AI Assistants";
    if (/google|bing|duckduckgo/.test(source)) return "Organic Search";
    if (/linkedin|twitter|facebook|reddit|youtube|instagram|^x$/.test(source)) return "Social";
    return "Referral";
  }
  return host ? "Referral" : "Direct";
}

/** The referring site's host and path, or nulls for none or this site itself. */
export function parseReferrer(input: unknown, ownHost: string | null): { host: string | null; path: string | null } {
  if (typeof input !== "string" || !input) return { host: null, path: null };
  try {
    const url = new URL(input);
    if (url.protocol !== "http:" && url.protocol !== "https:") return { host: null, path: null };
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (ownHost && host === ownHost.toLowerCase().replace(/^www\./, "")) return { host: null, path: null };
    const path = url.pathname === "/" ? null : url.pathname.slice(0, MAX_PATH_LENGTH);
    return { host: host.slice(0, 200), path };
  } catch {
    return { host: null, path: null };
  }
}

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|preview|facebookexternalhit|embedly|quora link|vercel|python|curl|wget|httpclient|axios|node-fetch|undici|go-http|java\/|okhttp|scrapy|phantomjs|selenium|playwright|puppeteer/i;

export function isBotAgent(userAgent: string | null): boolean {
  return !userAgent || userAgent.length < 20 || BOT.test(userAgent);
}

/** Global Privacy Control or Do Not Track: the browser asked not to be tracked. */
export function optedOut(headers: Headers): boolean {
  return headers.get("sec-gpc") === "1" || headers.get("dnt") === "1";
}
