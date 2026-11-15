import "server-only";

/*
 * Client for the Cypher content API, which stores ZODE's posts and their
 * images alongside every other site's. Every request carries ZODE's key, so
 * drafts are visible and reads skip the CDN's shared cache.
 */

const DEFAULT_API_URL = "https://cypher-website-vercel.vercel.app";
const TIMEOUT_MS = 10_000;

/** What the API answered with, when it wasn't a success. */
export class CypherError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CypherError";
  }
}

interface Config {
  apiUrl: string;
  key: string;
  site: string;
}

function config(): Config {
  const key = process.env.CYPHER_API_KEY;
  if (!key) throw new Error("CYPHER_API_KEY is not set.");
  return {
    apiUrl: (process.env.CYPHER_API_URL || DEFAULT_API_URL).replace(/\/+$/, ""),
    key,
    site: process.env.CYPHER_SITE || "zode",
  };
}

/** A URL on the Cypher site, for proxying what isn't under this site's API path. */
export const cypherUrl = (path: string): string => `${config().apiUrl}${path}`;

/** The post as the API sends it; dates are ISO strings. */
export interface ApiPost {
  id: string;
  kind: string;
  status: string;
  slug: string;
  title: string;
  summary: string;
  bodyMd?: string;
  version: string | null;
  coverPathname: string | null;
  author: { userId: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
  updatedByEmail: string | null;
  publishedAt: string | null;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, string | undefined>;
  body?: unknown;
}

/**
 * Calls `path` under this site's API, such as `/posts/{id}`. Resolves to the
 * response's JSON, or `null` on a 404; anything else unsuccessful throws a
 * `CypherError`.
 */
export async function siteApi<T>(path: string, options: RequestOptions = {}): Promise<T | null> {
  const { apiUrl, key, site } = config();
  const url = new URL(`${apiUrl}/api/v1/sites/${site}${path}`);
  for (const [name, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(name, value);
  }
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    throw new CypherError(
      response.status,
      payload?.error?.code ?? "unknown",
      payload?.error?.message ?? `The Cypher API answered ${response.status}.`,
    );
  }
  return (await response.json()) as T;
}

/** Forwards `body` to this site's API as is, for requests the browser composes, like Blob upload tokens. */
export async function forwardToSiteApi(path: string, body: string): Promise<Response> {
  const { apiUrl, key, site } = config();
  return fetch(`${apiUrl}/api/v1/sites/${site}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}
