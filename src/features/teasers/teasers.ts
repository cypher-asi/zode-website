import "server-only";
import { randomUUID } from "node:crypto";
import { cacheLife, cacheTag } from "next/cache";
import { isUuid } from "@/features/zrm/access";
import { DB_TAG, db } from "@/lib/db";
import type { AvailabilityRow, LabeledValue, Stat, Teaser, TeaserInput } from "./types";

/** Every teaser read is cached under this tag, which saving and deleting update. */
export const TEASERS_TAG = "teasers";

const toTeaser = (row: Record<string, unknown>): Teaser => ({
  id: String(row.id),
  name: String(row.name),
  deploymentId: row.deployment_id == null ? null : String(row.deployment_id),
  deploymentName: row.deployment_name == null ? null : String(row.deployment_name),
  eyebrow: String(row.eyebrow),
  headline: String(row.headline),
  subheadline: String(row.subheadline),
  stats: (row.stats as Stat[]) ?? [],
  summary: String(row.summary),
  highlights: String(row.highlights),
  availability: (row.availability as AvailabilityRow[]) ?? [],
  specs: (row.specs as LabeledValue[]) ?? [],
  terms: (row.terms as LabeledValue[]) ?? [],
  contactName: String(row.contact_name),
  contactEmail: String(row.contact_email),
  updatedAt: new Date(row.updated_at as string | Date).toISOString(),
});

/** Every teaser, most recently edited first. The ZODE team's only, but the same for each of them, so cached on the server. */
export async function listTeasers(): Promise<Teaser[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TEASERS_TAG, DB_TAG);
  const rows = await db()`
    select t.*, d.name as deployment_name
    from teasers t
    left join deployments d on d.id = t.deployment_id
    order by t.updated_at desc
  `;
  return rows.map(toTeaser);
}

/** One teaser, from the cached list. */
export async function getTeaser(id: string): Promise<Teaser | null> {
  if (!isUuid(id)) return null;
  return (await listTeasers()).find((teaser) => teaser.id === id) ?? null;
}

/** Creates a teaser (`id` null) or updates one. Returns its id, or null when the one being edited is gone. */
export async function saveTeaser(id: string | null, t: TeaserInput, userId: number | null): Promise<string | null> {
  const sql = db();
  const json = (value: unknown) => JSON.stringify(value);
  const rows = id
    ? await sql`
        update teasers set
          name = ${t.name}, deployment_id = ${t.deploymentId}, eyebrow = ${t.eyebrow}, headline = ${t.headline},
          subheadline = ${t.subheadline}, stats = ${json(t.stats)}::jsonb, summary = ${t.summary},
          highlights = ${t.highlights}, availability = ${json(t.availability)}::jsonb, specs = ${json(t.specs)}::jsonb,
          terms = ${json(t.terms)}::jsonb, contact_name = ${t.contactName}, contact_email = ${t.contactEmail},
          updated_by = ${userId}, updated_at = now()
        where id = ${id}
        returning id
      `
    : await sql`
        insert into teasers (
          id, name, deployment_id, eyebrow, headline, subheadline, stats, summary, highlights, availability,
          specs, terms, contact_name, contact_email, created_by, updated_by
        ) values (
          ${randomUUID()}, ${t.name}, ${t.deploymentId}, ${t.eyebrow}, ${t.headline}, ${t.subheadline},
          ${json(t.stats)}::jsonb, ${t.summary}, ${t.highlights}, ${json(t.availability)}::jsonb,
          ${json(t.specs)}::jsonb, ${json(t.terms)}::jsonb, ${t.contactName}, ${t.contactEmail}, ${userId}, ${userId}
        )
        returning id
      `;
  return rows.length ? String(rows[0].id) : null;
}

export async function deleteTeaser(id: string): Promise<void> {
  if (!isUuid(id)) return;
  await db()`delete from teasers where id = ${id}`;
}
