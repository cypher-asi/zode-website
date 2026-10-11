import type { NextRequest } from "next/server";
import { exportEvents } from "@/features/data-room/audit";
import { contentDisposition, notFoundResponse } from "@/features/data-room/http";
import { isUuid, roomAccess } from "@/features/data-room/rooms";
import { AUDIT_ACTION_LABELS } from "@/features/data-room/types";

const cell = (value: unknown): string => {
  const text = value == null ? "" : String(value);
  // Leading =, +, - or @ would run as a formula when opened in a spreadsheet.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** The room's audit trail as CSV, with the same filters as the Activity page. Admins only. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/data-rooms/[roomId]/activity">) {
  const { roomId } = await ctx.params;
  const access = await roomAccess(roomId, "admin");
  if (!access) return notFoundResponse();

  const search = request.nextUrl.searchParams;
  const fileId = search.get("file") ?? undefined;
  const events = await exportEvents(roomId, {
    action: search.get("action") || undefined,
    actor: search.get("actor") || undefined,
    fileId: isUuid(fileId) ? fileId : undefined,
  });

  const lines = [
    ["Time (UTC)", "Person", "Action", "File", "Details", "IP", "User agent"].join(","),
    ...events.map((event) => {
      const { name, ...rest } = event.detail;
      return [
        event.createdAt,
        event.actorEmail,
        AUDIT_ACTION_LABELS[event.action] ?? event.action,
        name,
        Object.keys(rest).length ? JSON.stringify(rest) : "",
        event.ip,
        event.userAgent,
      ]
        .map(cell)
        .join(",");
    }),
  ];

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(`${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": contentDisposition("attachment", `${access.room.name} activity ${stamp}.csv`),
      "Cache-Control": "private, no-store",
    },
  });
}
