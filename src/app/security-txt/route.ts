import { cacheLife } from "next/cache";
import { RECIPIENT_EMAIL } from "@/lib/leads";
import { SITE_URL } from "@/lib/site";

/**
 * RFC 9116 vulnerability-disclosure contact, served at
 * `/.well-known/security.txt` via the rewrite in `next.config.ts`.
 *
 * Generated rather than checked in as a static file because `Expires` is a
 * required field that has to stay in the future — regenerating daily keeps it
 * valid without anyone remembering to edit a date once a year.
 */
const EXPIRES_AFTER_DAYS = 180;

async function securityTxt(): Promise<string> {
  "use cache";
  cacheLife("days");
  const expires = new Date(Date.now() + EXPIRES_AFTER_DAYS * 86400 * 1000);

  return [
    `Contact: mailto:${RECIPIENT_EMAIL}`,
    `Expires: ${expires.toISOString()}`,
    "Preferred-Languages: en",
    `Canonical: ${SITE_URL}/.well-known/security.txt`,
    "",
  ].join("\n");
}

export async function GET(): Promise<Response> {
  return new Response(await securityTxt(), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
