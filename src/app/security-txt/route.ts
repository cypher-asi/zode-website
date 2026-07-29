import { RECIPIENT_EMAIL } from "@/lib/leads";
import { SITE_URL } from "@/lib/site";

/**
 * RFC 9116 vulnerability-disclosure contact, served at
 * `/.well-known/security.txt` via the rewrite in `next.config.ts`.
 *
 * Generated rather than checked in as a static file because `Expires` is a
 * required field that has to stay in the future — revalidating daily keeps it
 * valid without anyone remembering to edit a date once a year.
 */
export const revalidate = 86400;

const EXPIRES_AFTER_DAYS = 180;

export function GET(): Response {
  const expires = new Date(Date.now() + EXPIRES_AFTER_DAYS * 86400 * 1000);

  const body = [
    `Contact: mailto:${RECIPIENT_EMAIL}`,
    `Expires: ${expires.toISOString()}`,
    "Preferred-Languages: en",
    `Canonical: ${SITE_URL}/.well-known/security.txt`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
