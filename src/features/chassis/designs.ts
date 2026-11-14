import "server-only";
import { createHash } from "node:crypto";
import { cacheLife, cacheTag } from "next/cache";
import { BOM_TAG } from "@/features/deployments/bom/bom";
import { DEPLOYMENTS_TAG, listDeployments } from "@/features/deployments/deployments";
import { isUuid } from "@/features/zrm/access";
import { DB_TAG, db } from "@/lib/db";
import { derive } from "./model/calc";
import type { DesignData } from "./model/schema";
import { safeParseDesign } from "./model/seed";
import {
  quoteItemsOf,
  type DeploymentTarget,
  type DesignSummary,
  type DesignUse,
  type OpenDesign,
  type VersionInfo,
} from "./types";

/** Every read of designs is cached under this tag, which saving updates. */
export const CHASSIS_TAG = "chassis";

const iso = (value: unknown): string => new Date(value as string | Date).toISOString();

async function usesBy(designIds: readonly string[]): Promise<Map<string, DesignUse[]>> {
  const uses = new Map<string, DesignUse[]>();
  if (!designIds.length) return uses;
  const rows = await db()`
    select q.chassis_design_id, q.chassis_version, q.id as quote_id, d.id as deployment_id, d.name as deployment_name
    from deployment_quotes q
    join deployments d on d.id = q.deployment_id
    where q.chassis_design_id = any(${designIds}::uuid[])
    order by d.name
  `;
  for (const row of rows) {
    const id = String(row.chassis_design_id);
    uses.set(id, [
      ...(uses.get(id) ?? []),
      {
        deploymentId: String(row.deployment_id),
        deploymentName: String(row.deployment_name),
        quoteId: String(row.quote_id),
        version: Number(row.chassis_version ?? 0),
      },
    ]);
  }
  return uses;
}

/** Every design, newest edit first, with figures from its latest version. */
export async function listDesigns(): Promise<DesignSummary[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CHASSIS_TAG, BOM_TAG, DEPLOYMENTS_TAG, DB_TAG);
  const rows = await db()`
    select c.id, c.name, c.version, c.updated_at, c.archived_at, v.data
    from chassis_designs c
    join chassis_design_versions v on v.design_id = c.id and v.version = c.version
    order by c.archived_at is not null, c.updated_at desc
  `;
  const uses = await usesBy(rows.map((row) => String(row.id)));
  return rows.flatMap((row): DesignSummary[] => {
    const data = safeParseDesign(row.data);
    if (!data) return [];
    const derived = derive(data);
    return [
      {
        id: String(row.id),
        name: String(row.name),
        version: Number(row.version),
        revision: data.project.revision,
        status: data.project.status,
        totalUsd: derived.bom.total,
        failingChecks: derived.checks.filter((check) => check.status === "fail").length,
        updatedAt: iso(row.updated_at),
        archived: row.archived_at != null,
        uses: uses.get(String(row.id)) ?? [],
      },
    ];
  });
}

/** Design `id` at `version`, its latest when null; null when either doesn't exist. */
export async function getDesign(id: string, version: number | null = null): Promise<OpenDesign | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CHASSIS_TAG, BOM_TAG, DEPLOYMENTS_TAG, DB_TAG);
  if (!isUuid(id)) return null;
  const sql = db();
  const [designs, versions] = await Promise.all([
    sql`select id, name, version, archived_at from chassis_designs where id = ${id}`,
    sql`
      select v.version, v.note, v.created_at, v.data, coalesce(a.display_name, a.email) as created_by
      from chassis_design_versions v
      left join users u on u.id = v.created_by
      left join account_directory a on a.user_id = u.zos_user_id
      where v.design_id = ${id}
      order by v.version desc
    `,
  ]);
  const [design] = designs;
  if (!design) return null;
  const shown = versions.find((row) => Number(row.version) === (version ?? Number(design.version)));
  const data = shown ? safeParseDesign(shown.data) : null;
  if (!shown || !data) return null;
  const uses = await usesBy([id]);
  return {
    id: String(design.id),
    name: String(design.name),
    version: Number(shown.version),
    latestVersion: Number(design.version),
    data,
    archived: design.archived_at != null,
    versions: versions.map(
      (row): VersionInfo => ({
        version: Number(row.version),
        note: row.note == null ? null : String(row.note),
        createdAt: iso(row.created_at),
        createdBy: row.created_by == null ? null : String(row.created_by),
      }),
    ),
    uses: uses.get(id) ?? [],
  };
}

/** Deployments a design can be sent to, each with its phases in rollout order. */
export async function listTargets(): Promise<DeploymentTarget[]> {
  const deployments = await listDeployments();
  return deployments.map((deployment) => ({
    id: deployment.id,
    name: deployment.name,
    status: deployment.status,
    phases: [...deployment.phases]
      .sort((a, b) => a.rfsOn.localeCompare(b.rfsOn))
      .map((phase, i) => ({ id: phase.id, label: `${phase.name || `Phase ${i + 1}`} (RFS ${phase.rfsOn})` })),
  }));
}

/** A new design at version 1. */
export async function createDesign(name: string, data: DesignData, userId: number | null, note: string): Promise<string> {
  const id = crypto.randomUUID();
  const sql = db();
  await sql.transaction([
    sql`
      insert into chassis_designs (id, name, version, created_by, updated_by)
      values (${id}, ${name}, 1, ${userId}, ${userId})
    `,
    sql`
      insert into chassis_design_versions (design_id, version, data, note, created_by)
      values (${id}, 1, ${JSON.stringify(data)}::jsonb, ${note}, ${userId})
    `,
  ]);
  return id;
}

export type SaveOutcome = { version: number } | { conflict: number } | null;

/**
 * Saves `data` as the design's next version. Unless `force`, only when its
 * latest is still `baseVersion`, so one person's save doesn't silently undo
 * another's; otherwise resolves with the latest. Null when the design is gone.
 */
export async function saveVersion(
  id: string,
  baseVersion: number,
  data: DesignData,
  note: string | null,
  userId: number | null,
  force: boolean,
): Promise<SaveOutcome> {
  const sql = db();
  const [current] = await sql`select version from chassis_designs where id = ${id}`;
  if (!current) return null;
  const latest = Number(current.version);
  if (!force && latest !== baseVersion) return { conflict: latest };
  const next = latest + 1;
  const [bumped] = await sql.transaction([
    sql`
      update chassis_designs set version = ${next}, updated_by = ${userId}, updated_at = now()
      where id = ${id} and version = ${latest}
      returning version
    `,
    sql`
      insert into chassis_design_versions (design_id, version, data, note, created_by)
      select ${id}, ${next}, ${JSON.stringify(data)}::jsonb, ${note}, ${userId}
      where exists (select 1 from chassis_designs where id = ${id} and version = ${next})
    `,
  ]);
  return bumped.length ? { version: next } : { conflict: latest + 1 };
}

export async function renameDesign(id: string, name: string, userId: number | null): Promise<boolean> {
  const rows = await db()`
    update chassis_designs set name = ${name}, updated_by = ${userId}, updated_at = now() where id = ${id} returning id
  `;
  return rows.length > 0;
}

export async function setArchived(id: string, archived: boolean): Promise<boolean> {
  const rows = await db()`
    update chassis_designs set archived_at = ${archived ? new Date().toISOString() : null} where id = ${id} returning id
  `;
  return rows.length > 0;
}

/** The data of design `id` at `version`, uncached, for actions that write from it. */
export async function versionData(id: string, version: number): Promise<{ name: string; data: DesignData } | null> {
  const [row] = await db()`
    select c.name, v.data from chassis_designs c
    join chassis_design_versions v on v.design_id = c.id and v.version = ${version}
    where c.id = ${id}
  `;
  const data = row ? safeParseDesign(row.data) : null;
  return row && data ? { name: String(row.name), data } : null;
}

/** A stable uuid for a design's BOM line in a deployment's quote, so sending again keeps the item's id. */
function itemId(designId: string, deploymentId: string, lineId: string): string {
  const hex = createHash("sha1").update(`chassis:${designId}:${deploymentId}:${lineId}`).digest("hex");
  // Shaped as a version 5 (name-based) uuid.
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export interface SendInput {
  designId: string;
  version: number;
  deploymentId: string;
  /** The phase whose BOM takes the design's lines, or null to only write the quote. */
  phaseId: string | null;
  /** Sets of pods the phase needs; each line's quantity is multiplied by it. */
  sets: number;
}

/**
 * Writes the design version's BOM into the deployment as its chassis quote,
 * replacing what an earlier send wrote, and, with a phase, puts its lines on
 * that phase's BOM at `sets` times their quantities in place of the lines an
 * earlier send put there. Resolves with the quote's id, or null when the
 * design version, deployment or phase is gone.
 */
export async function sendToDeployment(input: SendInput): Promise<string | null> {
  const found = await versionData(input.designId, input.version);
  if (!found) return null;
  const { name, data } = found;
  const sql = db();
  if (input.phaseId) {
    const [phase] = await sql`
      select id from deployment_phases where id = ${input.phaseId} and deployment_id = ${input.deploymentId}
    `;
    if (!phase) return null;
  }

  const items = quoteItemsOf(data, derive(data)).map((item, position) => ({
    id: itemId(input.designId, input.deploymentId, item.lineId),
    position,
    section: item.section,
    part_number: item.partNumber,
    manufacturer: item.manufacturer,
    description: item.description,
    quantity: item.quantity,
    unit_usd: item.unitUsd,
    notes: item.notes,
    url: item.url,
  }));
  const vendor = `ZODE / ${name}`;
  const reference = `${data.project.name} REV ${data.project.revision} (version ${input.version})`;
  const total = items.reduce((sum, item) => sum + item.quantity * item.unit_usd, 0);
  const lines = input.phaseId
    ? items.map((item) => ({ ...item, quantity: item.quantity * input.sets, quote_item_id: item.id }))
    : [];

  const [deployment] = await sql`select id from deployments where id = ${input.deploymentId}`;
  if (!deployment) return null;

  const [, quote] = await sql.transaction([
    sql`
      insert into deployment_quotes (deployment_id, position, vendor, chassis_design_id)
      select ${input.deploymentId},
        coalesce((select max(position) + 1 from deployment_quotes where deployment_id = ${input.deploymentId}), 0),
        ${vendor}, ${input.designId}
      on conflict (deployment_id, chassis_design_id) where chassis_design_id is not null do nothing
    `,
    sql`
      update deployment_quotes set
        vendor = ${vendor}, reference = ${reference}, quoted_on = current_date, quoted_total_usd = ${total},
        chassis_version = ${input.version},
        notes = ${`Written from the Chassis app's ${name}, version ${input.version}, for one set of pods.`}
      where deployment_id = ${input.deploymentId} and chassis_design_id = ${input.designId}
      returning id
    `,
    // An earlier send's lines on this phase go, before its items do and unlink them.
    sql`
      delete from deployment_bom_lines l
      using deployment_quote_items i, deployment_quotes q
      where l.quote_item_id = i.id and i.quote_id = q.id
        and q.deployment_id = ${input.deploymentId} and q.chassis_design_id = ${input.designId}
        and l.phase_id = ${input.phaseId}
    `,
    sql`
      delete from deployment_quote_items i
      using deployment_quotes q
      where i.quote_id = q.id and q.deployment_id = ${input.deploymentId} and q.chassis_design_id = ${input.designId}
        and not (i.id = any(${items.map((item) => item.id)}::uuid[]))
    `,
    sql`
      insert into deployment_quote_items (
        id, quote_id, position, section, part_number, manufacturer, description, quantity, unit_usd, notes, url
      )
      select r.id, q.id, r.position, r.section, r.part_number, r.manufacturer, r.description, r.quantity, r.unit_usd,
        r.notes, r.url
      from jsonb_to_recordset(${JSON.stringify(items)}::jsonb) as r (
        id uuid, position integer, section text, part_number text, manufacturer text, description text,
        quantity numeric, unit_usd numeric, notes text, url text
      )
      join deployment_quotes q on q.deployment_id = ${input.deploymentId} and q.chassis_design_id = ${input.designId}
      on conflict (id) do update set
        position = excluded.position, section = excluded.section, part_number = excluded.part_number,
        manufacturer = excluded.manufacturer, description = excluded.description, quantity = excluded.quantity,
        unit_usd = excluded.unit_usd, notes = excluded.notes, url = excluded.url
      where deployment_quote_items.quote_id = excluded.quote_id
    `,
    sql`
      insert into deployment_bom_lines (
        deployment_id, phase_id, slot_id, position, quote_item_id, part_number, manufacturer, description,
        quantity, unit_usd, notes, url
      )
      select p.deployment_id, p.id, null,
        coalesce((select max(position) from deployment_bom_lines where deployment_id = p.deployment_id), 0)
          + 1 + r.position,
        r.quote_item_id, r.part_number, r.manufacturer, r.description, r.quantity, r.unit_usd, r.notes, r.url
      from jsonb_to_recordset(${JSON.stringify(lines)}::jsonb) as r (
        position integer, quote_item_id uuid, part_number text, manufacturer text, description text,
        quantity numeric, unit_usd numeric, notes text, url text
      )
      join deployment_phases p on p.id = ${input.phaseId} and p.deployment_id = ${input.deploymentId}
    `,
  ]);
  return quote[0] ? String(quote[0].id) : null;
}
