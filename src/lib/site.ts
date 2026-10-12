/** Canonical production origin, used for metadata, robots, and the sitemap. */
export const SITE_URL = "https://zode.org";

/** Links in email point at the deployment that sent them, so preview and local links stay testable. */
export function siteOrigin(): string {
  if (process.env.VERCEL_ENV === "production") return SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return process.env.NODE_ENV === "development" ? `http://localhost:${process.env.PORT || 3000}` : SITE_URL;
}
