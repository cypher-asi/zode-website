import { isZodeAdmin } from "@/features/account/admin";
import { getAccount } from "@/features/account/session";
import { notFoundResponse } from "@/features/data-room/http";
import { listSubscribers } from "@/features/mailing-list/subscribers";
import { isMailingList, isSubscriberStatus, type Subscriber } from "@/features/mailing-list/types";

const COLUMNS = [
  "list",
  "email",
  "name",
  "status",
  "user_id",
  "account_name",
  "source",
  "signed_up_at",
  "confirmed_at",
  "unsubscribed_at",
];

/** Quotes a CSV cell, and defuses values a spreadsheet would run as a formula. */
function cell(value: string | Date | null): string {
  if (value === null) return "";
  let text = value instanceof Date ? value.toISOString() : value;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const line = (s: Subscriber): string =>
  [s.list, s.email, s.name, s.status, s.userId, s.accountName, s.source, s.createdAt, s.confirmedAt, s.unsubscribedAt]
    .map(cell)
    .join(",");

const ROWS_PER_CHUNK = 500;

/** The mailing lists as CSV for ZODE admins, optionally one list and one status only (`?list=news&status=subscribed`). */
export async function GET(request: Request) {
  const account = await getAccount();
  if (!account || !(await isZodeAdmin(account))) return notFoundResponse();
  const search = new URL(request.url).searchParams;
  const list = search.get("list");
  const status = search.get("status");

  let subscribers;
  try {
    subscribers = await listSubscribers(isMailingList(list) ? list : null);
  } catch (error) {
    console.error("[mailing-list] export failed", error);
    return new Response("The mailing list couldn't be loaded. Try again shortly.", {
      status: 503,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  const rows = isSubscriberStatus(status) ? subscribers.filter((subscriber) => subscriber.status === status) : subscribers;

  const encoder = new TextEncoder();
  let at = 0;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`${COLUMNS.join(",")}\r\n`));
    },
    pull(controller) {
      if (at >= rows.length) return controller.close();
      const chunk = rows.slice(at, (at += ROWS_PER_CHUNK));
      controller.enqueue(encoder.encode(chunk.map((s) => `${line(s)}\r\n`).join("")));
    },
  });
  const day = new Date().toISOString().slice(0, 10);
  const parts = ["zode-mailing-list", isMailingList(list) ? list : null, isSubscriberStatus(status) ? status : null, day];
  const file = `${parts.filter(Boolean).join("-")}.csv`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
