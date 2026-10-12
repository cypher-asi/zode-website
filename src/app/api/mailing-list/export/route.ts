import { isZodeAdmin } from "@/features/account/admin";
import { getAccount } from "@/features/account/session";
import { notFoundResponse } from "@/features/data-room/http";
import { listSubscribers } from "@/features/mailing-list/subscribers";
import { isSubscriberStatus } from "@/features/mailing-list/types";

const COLUMNS = ["email", "name", "status", "user_id", "account_name", "source", "signed_up_at", "confirmed_at", "unsubscribed_at"];

/** Quotes a CSV cell, and defuses values a spreadsheet would run as a formula. */
function cell(value: string | Date | null): string {
  if (value === null) return "";
  let text = value instanceof Date ? value.toISOString() : value;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** The mailing list as CSV for ZODE admins, optionally one status only (`?status=subscribed`). */
export async function GET(request: Request) {
  const account = await getAccount();
  if (!account || !isZodeAdmin(account)) return notFoundResponse();
  const status = new URL(request.url).searchParams.get("status");

  let subscribers;
  try {
    subscribers = await listSubscribers();
  } catch (error) {
    console.error("[mailing-list] export failed", error);
    return new Response("The mailing list couldn't be loaded. Try again shortly.", {
      status: 503,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  if (isSubscriberStatus(status)) subscribers = subscribers.filter((subscriber) => subscriber.status === status);

  const lines = [
    COLUMNS.join(","),
    ...subscribers.map((s) =>
      [s.email, s.name, s.status, s.userId, s.accountName, s.source, s.createdAt, s.confirmedAt, s.unsubscribedAt]
        .map(cell)
        .join(","),
    ),
  ];
  const day = new Date().toISOString().slice(0, 10);
  const file = `zode-mailing-list${isSubscriberStatus(status) ? `-${status}` : ""}-${day}.csv`;
  return new Response(`${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
