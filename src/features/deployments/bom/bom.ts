import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { ClusterConfig } from "@/features/cluster/model/types";
import { isUuid } from "@/features/zrm/access";
import { DB_TAG, db } from "@/lib/db";
import { EMPTY_BOM, type Bom, type BomLine, type Quote, type QuoteItem } from "./types";

/** Every BOM read is cached under this tag, which saving updates. */
export const BOM_TAG = "deployment-bom";

/** Every quote file a deployment uploads is stored under this prefix in the private Blob store. */
export const quoteBlobPrefix = (deploymentId: string): string => `deployments/${deploymentId}/quotes/`;

export type QuoteInput = Omit<Quote, "file">;
export type BomLineInput = Omit<BomLine, "id">;

/** An uploaded file, as Blob storage reports it. */
export interface StoredQuoteFile {
  pathname: string;
  name: string;
  contentType: string;
  sizeBytes: number;
}

const str = (value: unknown): string | null => (value == null ? null : String(value));
const num = (value: unknown): number | null => (value == null ? null : Number(value));
const iso = (value: unknown): string => new Date(value as string | Date).toISOString();

/** The deployment's quotes, their items and its BOM lines. Money comes back as `::float8` and dates as `::text`, as for deployments. */
export async function getBom(deploymentId: string): Promise<Bom> {
  "use cache";
  cacheLife("minutes");
  cacheTag(BOM_TAG, DB_TAG);
  if (!isUuid(deploymentId)) return EMPTY_BOM;
  const sql = db();
  const [quotes, items, lines] = await Promise.all([
    sql`
      select q.id, q.vendor, q.reference, q.quoted_on::text as quoted_on, q.valid_until::text as valid_until,
        q.quoted_total_usd::float8 as quoted_total_usd, q.data_room_file_id, q.notes,
        q.file_name, q.file_content_type, q.file_size_bytes::float8 as file_size_bytes, q.file_uploaded_at,
        f.name as room_file_name, f.content_type as room_file_type, f.size_bytes::float8 as room_file_size,
        f.created_at as room_file_created_at
      from deployment_quotes q
      left join data_room_files f on f.id = q.data_room_file_id and f.deleted_at is null
      where q.deployment_id = ${deploymentId}
      order by q.position, q.created_at
    `,
    sql`
      select i.id, i.quote_id, i.section, i.part_number, i.manufacturer, i.description,
        i.quantity::float8 as quantity, i.unit_usd::float8 as unit_usd, i.lead_time, i.notes
      from deployment_quote_items i
      join deployment_quotes q on q.id = i.quote_id
      where q.deployment_id = ${deploymentId}
      order by q.position, q.created_at, i.position
    `,
    sql`
      select id, phase_id, slot_id, quote_item_id, part_number, manufacturer, description,
        quantity::float8 as quantity, unit_usd::float8 as unit_usd, notes
      from deployment_bom_lines
      where deployment_id = ${deploymentId}
      order by position
    `,
  ]);
  return {
    quotes: quotes.map(
      (row): Quote => ({
        id: String(row.id),
        vendor: String(row.vendor),
        reference: str(row.reference),
        quotedOn: str(row.quoted_on),
        validUntil: str(row.valid_until),
        quotedTotalUsd: num(row.quoted_total_usd),
        dataRoomFileId: row.room_file_name == null ? null : str(row.data_room_file_id),
        file:
          row.file_name != null
            ? {
                name: String(row.file_name),
                sizeBytes: Number(row.file_size_bytes ?? 0),
                contentType: String(row.file_content_type ?? "application/octet-stream"),
                createdAt: iso(row.file_uploaded_at),
                source: "upload",
              }
            : row.room_file_name != null
              ? {
                  name: String(row.room_file_name),
                  sizeBytes: Number(row.room_file_size ?? 0),
                  contentType: String(row.room_file_type ?? "application/octet-stream"),
                  createdAt: iso(row.room_file_created_at),
                  source: "data-room",
                }
              : null,
        notes: str(row.notes),
      }),
    ),
    items: items.map(
      (row): QuoteItem => ({
        id: String(row.id),
        quoteId: String(row.quote_id),
        section: String(row.section),
        partNumber: str(row.part_number),
        manufacturer: str(row.manufacturer),
        description: String(row.description),
        quantity: num(row.quantity),
        unitUsd: num(row.unit_usd),
        leadTime: str(row.lead_time),
        notes: str(row.notes),
      }),
    ),
    lines: lines.map(
      (row): BomLine => ({
        id: String(row.id),
        phaseId: String(row.phase_id),
        slotId: str(row.slot_id),
        quoteItemId: str(row.quote_item_id),
        partNumber: str(row.part_number),
        manufacturer: str(row.manufacturer),
        description: String(row.description),
        quantity: Number(row.quantity),
        unitUsd: num(row.unit_usd),
        notes: str(row.notes),
      }),
    ),
  };
}

/** Where a quote's file is: its uploaded blob, or the data room file it links. Null when it has neither. */
export async function quoteFileSource(
  deploymentId: string,
  quoteId: string,
): Promise<{ pathname: string; name: string; contentType: string; sizeBytes: number } | null> {
  if (!isUuid(deploymentId) || !isUuid(quoteId)) return null;
  const [row] = await db()`
    select q.file_pathname, q.file_name, q.file_content_type, q.file_size_bytes::float8 as file_size_bytes,
      f.blob_pathname, f.name as room_file_name, f.content_type as room_file_type, f.size_bytes::float8 as room_file_size
    from deployment_quotes q
    join deployments d on d.id = q.deployment_id
    left join data_room_files f
      on f.id = q.data_room_file_id and f.room_id = d.data_room_id and f.deleted_at is null
    where q.id = ${quoteId} and q.deployment_id = ${deploymentId}
  `;
  if (!row) return null;
  if (row.file_pathname != null) {
    return {
      pathname: String(row.file_pathname),
      name: String(row.file_name),
      contentType: String(row.file_content_type ?? "application/octet-stream"),
      sizeBytes: Number(row.file_size_bytes ?? 0),
    };
  }
  if (row.blob_pathname != null) {
    return {
      pathname: String(row.blob_pathname),
      name: String(row.room_file_name),
      contentType: String(row.room_file_type ?? "application/octet-stream"),
      sizeBytes: Number(row.room_file_size ?? 0),
    };
  }
  return null;
}

/** Quote item ids among these that belong to a deployment other than `deploymentId`. */
export async function foreignItemIds(deploymentId: string, itemIds: readonly string[]): Promise<string[]> {
  if (!itemIds.length) return [];
  const rows = await db()`
    select i.id from deployment_quote_items i join deployment_quotes q on q.id = i.quote_id
    where i.id = any(${itemIds}::uuid[]) and q.deployment_id <> ${deploymentId}
  `;
  return rows.map((row) => String(row.id));
}

/** A new quote at the end of the deployment's, named `vendor`, with `file` as its own. */
export async function createQuote(deploymentId: string, vendor: string, file: StoredQuoteFile | null): Promise<string | null> {
  const [row] = await db()`
    insert into deployment_quotes (
      deployment_id, position, vendor, file_pathname, file_name, file_content_type, file_size_bytes, file_uploaded_at
    )
    select d.id, coalesce((select max(position) + 1 from deployment_quotes where deployment_id = d.id), 0), ${vendor},
      ${file?.pathname ?? null}, ${file?.name ?? null}, ${file?.contentType ?? null}, ${file?.sizeBytes ?? null},
      ${file ? new Date().toISOString() : null}
    from deployments d where d.id = ${deploymentId}
    returning id
  `;
  return row ? String(row.id) : null;
}

/**
 * Saves one quote's details and replaces its items: items keep their ids, so
 * BOM lines stay linked to them, and an item left out goes, its lines keeping
 * what they copied. Checking `dataRoomFileId` is the caller's.
 */
export async function saveQuote(deploymentId: string, quote: QuoteInput, items: readonly QuoteItem[]): Promise<boolean> {
  const sql = db();
  const rows = items.map((item, position) => ({
    id: item.id,
    position,
    section: item.section,
    part_number: item.partNumber,
    manufacturer: item.manufacturer,
    description: item.description,
    quantity: item.quantity,
    unit_usd: item.unitUsd,
    lead_time: item.leadTime,
    notes: item.notes,
  }));
  const [updated] = await sql.transaction([
    sql`
      update deployment_quotes set
        vendor = ${quote.vendor}, reference = ${quote.reference}, quoted_on = ${quote.quotedOn},
        valid_until = ${quote.validUntil}, quoted_total_usd = ${quote.quotedTotalUsd},
        data_room_file_id = ${quote.dataRoomFileId}, notes = ${quote.notes}
      where id = ${quote.id} and deployment_id = ${deploymentId}
      returning id
    `,
    sql`
      delete from deployment_quote_items i
      using deployment_quotes q
      where q.id = i.quote_id and q.id = ${quote.id} and q.deployment_id = ${deploymentId}
        and not (i.id = any(${items.map((item) => item.id)}::uuid[]))
    `,
    sql`
      insert into deployment_quote_items (
        id, quote_id, position, section, part_number, manufacturer, description, quantity, unit_usd, lead_time, notes
      )
      select r.id, q.id, r.position, r.section, r.part_number, r.manufacturer, r.description, r.quantity,
        r.unit_usd, r.lead_time, r.notes
      from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) as r (
        id uuid, position integer, section text, part_number text, manufacturer text,
        description text, quantity numeric, unit_usd numeric, lead_time text, notes text
      )
      join deployment_quotes q on q.id = ${quote.id} and q.deployment_id = ${deploymentId}
      on conflict (id) do update set
        position = excluded.position, section = excluded.section, part_number = excluded.part_number,
        manufacturer = excluded.manufacturer, description = excluded.description, quantity = excluded.quantity,
        unit_usd = excluded.unit_usd, lead_time = excluded.lead_time, notes = excluded.notes
      where deployment_quote_items.quote_id = excluded.quote_id
    `,
  ]);
  return updated.length > 0;
}

export async function renameQuote(deploymentId: string, quoteId: string, vendor: string): Promise<boolean> {
  const rows = await db()`
    update deployment_quotes set vendor = ${vendor} where id = ${quoteId} and deployment_id = ${deploymentId} returning id
  `;
  return rows.length > 0;
}

/**
 * Sets the quote's own file, or clears it with null. Resolves with the blob it
 * had, for the caller to delete, or undefined when the quote is gone.
 */
export async function setQuoteFile(
  deploymentId: string,
  quoteId: string,
  file: StoredQuoteFile | null,
): Promise<string | null | undefined> {
  const [row] = await db()`
    update deployment_quotes q set
      file_pathname = ${file?.pathname ?? null}, file_name = ${file?.name ?? null},
      file_content_type = ${file?.contentType ?? null}, file_size_bytes = ${file?.sizeBytes ?? null},
      file_uploaded_at = ${file ? new Date().toISOString() : null}
    from (select id, file_pathname from deployment_quotes where id = ${quoteId} and deployment_id = ${deploymentId}) prev
    where q.id = prev.id
    returning prev.file_pathname
  `;
  return row ? str(row.file_pathname) : undefined;
}

/** Deletes the quote and its items; BOM lines picked from them keep what they copied. Resolves with its blob, for the caller to delete. */
export async function deleteQuote(deploymentId: string, quoteId: string): Promise<string | null | undefined> {
  const [row] = await db()`
    delete from deployment_quotes where id = ${quoteId} and deployment_id = ${deploymentId} returning file_pathname
  `;
  return row ? str(row.file_pathname) : undefined;
}

/**
 * Replaces the deployment's BOM lines. A line's phase must be the
 * deployment's, and its quote item is kept only when it's one of the
 * deployment's quotes'.
 */
export async function saveBomLines(deploymentId: string, lines: readonly BomLineInput[]): Promise<void> {
  const sql = db();
  const rows = lines.map((line, position) => ({
    phase_id: line.phaseId,
    slot_id: line.slotId,
    position,
    quote_item_id: line.quoteItemId,
    part_number: line.partNumber,
    manufacturer: line.manufacturer,
    description: line.description,
    quantity: line.quantity,
    unit_usd: line.unitUsd,
    notes: line.notes,
  }));
  await sql.transaction([
    sql`delete from deployment_bom_lines where deployment_id = ${deploymentId}`,
    sql`
      insert into deployment_bom_lines (
        deployment_id, phase_id, slot_id, position, quote_item_id, part_number, manufacturer, description,
        quantity, unit_usd, notes
      )
      select p.deployment_id, p.id, r.slot_id, r.position, i.id, r.part_number, r.manufacturer, r.description,
        r.quantity, r.unit_usd, r.notes
      from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) as r (
        phase_id uuid, slot_id text, position integer, quote_item_id uuid, part_number text, manufacturer text,
        description text, quantity numeric, unit_usd numeric, notes text
      )
      join deployment_phases p on p.id = r.phase_id and p.deployment_id = ${deploymentId}
      left join deployment_quote_items i on i.id = r.quote_item_id
        and i.quote_id in (select id from deployment_quotes where deployment_id = ${deploymentId})
    `,
  ]);
}

/** Saves phase `phaseId`'s cluster-builder config; null goes back to deriving it. False when the phase is gone. */
export async function savePhaseCluster(
  deploymentId: string,
  phaseId: string,
  config: ClusterConfig | null,
  copies: number,
): Promise<boolean> {
  const rows = await db()`
    update deployment_phases
    set cluster_config = ${config === null ? null : JSON.stringify(config)}::jsonb, cluster_copies = ${copies}
    where id = ${phaseId} and deployment_id = ${deploymentId}
    returning id
  `;
  return rows.length > 0;
}
