import "server-only";
import { headers } from "next/headers";
import { after } from "next/server";
import { db } from "./db";

export interface Limit {
  /** What is being counted, e.g. `login:ip:203.0.113.7`. */
  key: string;
  max: number;
  windowSeconds: number;
  /** Hits this request counts for, e.g. one per invite in a batch. Defaults to 1. */
  cost?: number;
}

export const RATE_LIMITED = "Too many attempts. Please wait a while and try again.";

/** Longest window in use; rows older than this are pruned. */
const MAX_WINDOW_SECONDS = 24 * 60 * 60;

/** The client's IP. Vercel sets `x-real-ip` itself, so clients can't spoof it there. */
export async function clientIp(): Promise<string> {
  const list = await headers();
  return list.get("x-real-ip") || list.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * Counts this request against each limit and reports whether all are still
 * within their max. Fails open: if the database is unreachable the request is
 * allowed and the error logged, so an outage doesn't lock everyone out.
 */
export async function withinLimits(limits: readonly Limit[]): Promise<boolean> {
  const now = Date.now();
  let hits: number[];
  try {
    hits = await Promise.all(
      limits.map(async ({ key, windowSeconds, cost = 1 }) => {
        const windowMs = windowSeconds * 1000;
        const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
        const [row] = await db()`
          insert into rate_limits (key, window_start, hits) values (${key}, ${windowStart}, ${cost})
          on conflict (key, window_start) do update set hits = rate_limits.hits + excluded.hits
          returning hits
        `;
        return Number(row.hits);
      }),
    );
  } catch (error) {
    console.error("[rate-limit] check failed; allowing the request", error);
    return true;
  }

  // Occasional cleanup keeps the table small without a cron job.
  if (Math.random() < 0.02) {
    after(() =>
      db()`delete from rate_limits where window_start < now() - make_interval(secs => ${MAX_WINDOW_SECONDS * 2})`.catch(
        (error: unknown) => console.error("[rate-limit] prune failed", error),
      ),
    );
  }

  return hits.every((count, i) => count <= limits[i].max);
}
