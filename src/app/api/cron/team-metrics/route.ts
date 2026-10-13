import { timingSafeEqual } from "node:crypto";
import { recordTeamSnapshot } from "@/features/team-dashboard/metrics";

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; anything else is refused. */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

/**
 * Takes the day's team dashboard snapshot, scheduled in vercel.json, so the
 * history has a point for every day whether or not anyone opened the dashboard.
 */
export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  const values = await recordTeamSnapshot();
  return Response.json({ ok: true, values });
}
