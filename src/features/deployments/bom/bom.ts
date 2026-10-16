import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { ClusterConfig } from "@/features/cluster/model/types";
import { isUuid } from "@/features/zrm/access";
import { DB_TAG, db } from "@/lib/db";
import { EMPTY_BOM, type Bom, type BomFill, type BomItem, type ItemStatus, type Quote } from "./types";

/** Every BOM read is cached under this tag, which saving updates. */
export const BOM_TAG = "deployment-bom";

export type QuoteInput = Omit<Quote, "dataRoomFileName">;
export type BomItemInput = Omit<BomItem, "id">;
export interface BomInput {
  quotes: QuoteInput[];
  items: BomItemInput[];
}

const str = (value: unknown): string | null => (value == null ? null : String(value));
const num = (value: unknown): number | null => (value == null ? null : Number(value));

/** The deployment's quotes and lines. Money comes back as `::float8` and dates as `::text`, as for deployments. */
export async function getBom(deploymentId: string): Promise<Bom> {
  "use cache";
  cacheLife("minutes");
  cacheTag(BOM_TAG, DB_TAG);
  if (!isUuid(deploymentId)) return EMPTY_BOM;
  const sql = db();
  const [quotes, items] = await Promise.all([
    sql`
      select q.id, q.vendor, q.reference, q.quoted_on::text as quoted_on, q.valid_until::text as valid_until,
        q.quoted_total_usd::float8 as quoted_total_usd, q.data_room_file_id, f.name as file_name, q.notes
      from deployment_quotes q
      left join data_room_files f on f.id = q.data_room_file_id and f.deleted_at is null
      where q.deployment_id = ${deploymentId}
      order by q.position, q.created_at
    `,
    sql`
      select i.id, i.phase_id, i.quote_id, i.quote_section, i.part_number, i.description,
        i.quantity::float8 as quantity, i.quoted_quantity::float8 as quoted_quantity, i.unit_usd::float8 as unit_usd,
        i.status, i.excluded_reason, i.lead_time, i.notes,
        coalesce(
          (select json_agg(json_build_object('slotId', f.slot_id, 'unitsPerItem', f.units_per_item::float8)
              order by f.slot_id)
            from deployment_bom_fills f where f.item_id = i.id),
          '[]'::json
        ) as fills
      from deployment_bom_items i
      left join deployment_quotes q on q.id = i.quote_id
      where i.deployment_id = ${deploymentId}
      order by q.position nulls last, q.created_at, i.position
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
        dataRoomFileId: row.file_name == null ? null : str(row.data_room_file_id),
        dataRoomFileName: str(row.file_name),
        notes: str(row.notes),
      }),
    ),
    items: items.map(
      (row): BomItem => ({
        id: String(row.id),
        phaseId: str(row.phase_id),
        quoteId: str(row.quote_id),
        quoteSection: String(row.quote_section),
        partNumber: str(row.part_number),
        description: String(row.description),
        quantity: Number(row.quantity),
        quotedQuantity: num(row.quoted_quantity),
        unitUsd: num(row.unit_usd),
        status: row.status as ItemStatus,
        excludedReason: str(row.excluded_reason),
        leadTime: str(row.lead_time),
        notes: str(row.notes),
        fills: row.fills as BomFill[],
      }),
    ),
  };
}

/** Quote ids among `ids` that belong to a deployment other than `deploymentId`. */
export async function foreignQuoteIds(deploymentId: string, ids: readonly string[]): Promise<string[]> {
  if (!ids.length) return [];
  const rows = await db()`
    select id from deployment_quotes where id = any(${ids}::uuid[]) and deployment_id <> ${deploymentId}
  `;
  return rows.map((row) => String(row.id));
}

/**
 * Replaces the deployment's BOM in one transaction: quotes keep their ids
 * (and import keys), a quote left out goes with its lines, and every line and
 * fill is written again. Checking that phases, quotes and files belong to the
 * deployment is the caller's.
 */
export async function saveBom(deploymentId: string, input: BomInput): Promise<void> {
  const sql = db();
  const quoteIds = input.quotes.map((quote) => quote.id);
  const items = input.items.map((item, position) => ({ ...item, id: crypto.randomUUID(), position }));
  const itemRows = items.map((item) => ({
    id: item.id,
    phase_id: item.phaseId,
    quote_id: item.quoteId,
    quote_section: item.quoteSection,
    position: item.position,
    part_number: item.partNumber,
    description: item.description,
    quantity: item.quantity,
    quoted_quantity: item.quotedQuantity,
    unit_usd: item.unitUsd,
    status: item.status,
    excluded_reason: item.excludedReason,
    lead_time: item.leadTime,
    notes: item.notes,
  }));
  const fillRows = items.flatMap((item) =>
    item.fills.map((fill) => ({ item_id: item.id, slot_id: fill.slotId, units_per_item: fill.unitsPerItem })),
  );

  await sql.transaction([
    sql`delete from deployment_bom_items where deployment_id = ${deploymentId}`,
    sql`
      delete from deployment_quotes
      where deployment_id = ${deploymentId} and not (id = any(${quoteIds}::uuid[]))
    `,
    ...input.quotes.map(
      (q, position) => sql`
        insert into deployment_quotes (
          id, deployment_id, position, vendor, reference, quoted_on, valid_until, quoted_total_usd,
          data_room_file_id, notes
        )
        select ${q.id}, id, ${position}, ${q.vendor}, ${q.reference}, ${q.quotedOn}, ${q.validUntil},
          ${q.quotedTotalUsd}, ${q.dataRoomFileId}, ${q.notes}
        from deployments where id = ${deploymentId}
        on conflict (id) do update set
          position = excluded.position, vendor = excluded.vendor, reference = excluded.reference,
          quoted_on = excluded.quoted_on, valid_until = excluded.valid_until,
          quoted_total_usd = excluded.quoted_total_usd, data_room_file_id = excluded.data_room_file_id,
          notes = excluded.notes
        where deployment_quotes.deployment_id = excluded.deployment_id
      `,
    ),
    sql`
      insert into deployment_bom_items (
        id, deployment_id, phase_id, quote_id, quote_section, position, part_number, description, quantity,
        quoted_quantity, unit_usd, status, excluded_reason, lead_time, notes
      )
      select r.id, d.id, r.phase_id, r.quote_id, r.quote_section, r.position, r.part_number, r.description,
        r.quantity, r.quoted_quantity, r.unit_usd, r.status, r.excluded_reason, r.lead_time, r.notes
      from jsonb_to_recordset(${JSON.stringify(itemRows)}::jsonb) as r (
        id uuid, phase_id uuid, quote_id uuid, quote_section text, position integer, part_number text,
        description text, quantity numeric, quoted_quantity numeric, unit_usd numeric, status text,
        excluded_reason text, lead_time text, notes text
      )
      join deployments d on d.id = ${deploymentId}
    `,
    sql`
      insert into deployment_bom_fills (item_id, slot_id, units_per_item)
      select r.item_id, r.slot_id, r.units_per_item
      from jsonb_to_recordset(${JSON.stringify(fillRows)}::jsonb) as r (item_id uuid, slot_id text, units_per_item numeric)
      where exists (select 1 from deployment_bom_items i where i.id = r.item_id)
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
