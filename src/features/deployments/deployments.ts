import "server-only";
import { randomUUID } from "node:crypto";
import { cacheLife, cacheTag } from "next/cache";
import { isUuid } from "@/features/zrm/access";
import { DB_TAG, db } from "@/lib/db";
import type { Deployment, Phase } from "./types";

/** Every deployment read is cached under this tag, which saving and deleting update. */
export const DEPLOYMENTS_TAG = "deployments";

export type DeploymentInput = Omit<Deployment, "id" | "updatedAt">;

/*
 * Neon hands back `numeric` as strings and `date` as local-midnight Dates, so
 * money and MW are read as `::float8` and dates as `::text` (YYYY-MM-DD). Each
 * deployment's phases come along as one JSON array, in RFS order.
 */
const toDeployment = (row: Record<string, unknown>): Deployment => ({
  id: String(row.id),
  name: String(row.name),
  status: row.status as Deployment["status"],
  nodes: Number(row.nodes),
  platform: row.platform as Deployment["platform"],
  cooling: row.cooling as Deployment["cooling"],
  networking: row.networking as Deployment["networking"],
  storageTbPerNode: Number(row.storage_tb_per_node),
  address: row.address == null ? null : String(row.address),
  facility: (row.facility ?? null) as Deployment["facility"],
  termMonths: row.term_months == null ? null : Number(row.term_months),
  priceGpuHr: row.price_gpu_hr == null ? null : Number(row.price_gpu_hr),
  depositUsd: row.deposit_usd == null ? null : Number(row.deposit_usd),
  creditRating: (row.credit_rating ?? null) as Deployment["creditRating"],
  locRequired: Boolean(row.loc_required),
  locAmountUsd: row.loc_amount_usd == null ? null : Number(row.loc_amount_usd),
  creditGuarantee: Boolean(row.credit_guarantee),
  leaseGuarantee: Boolean(row.lease_guarantee),
  notes: row.notes == null ? null : String(row.notes),
  phases: (row.phases as Phase[]) ?? [],
  updatedAt: new Date(row.updated_at as string | Date).toISOString(),
});

/** Every deployment, active ones first, then planned, then completed. Shared by everyone, so cached on the server. */
export async function listDeployments(): Promise<Deployment[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(DEPLOYMENTS_TAG, DB_TAG);
  const rows = await db()`
    select d.id, d.name, d.status, d.nodes, d.platform, d.cooling, d.networking, d.storage_tb_per_node,
      d.address, d.facility, d.term_months, d.price_gpu_hr::float8 as price_gpu_hr,
      d.deposit_usd::float8 as deposit_usd, d.credit_rating, d.loc_required,
      d.loc_amount_usd::float8 as loc_amount_usd, d.credit_guarantee, d.lease_guarantee, d.notes, d.updated_at,
      coalesce(
        (select json_agg(
            json_build_object(
              'name', p.name, 'startOn', p.start_on::text, 'rfsOn', p.rfs_on::text,
              'nodes', p.nodes, 'mw', p.mw::float8
            ) order by p.rfs_on, p.position)
          from deployment_phases p where p.deployment_id = d.id),
        '[]'::json
      ) as phases
    from deployments d
    order by case d.status when 'active' then 0 when 'planned' then 1 else 2 end, lower(d.name)
  `;
  return rows.map(toDeployment);
}

/** One deployment, from the cached list. */
export async function getDeployment(id: string): Promise<Deployment | null> {
  if (!isUuid(id)) return null;
  return (await listDeployments()).find((deployment) => deployment.id === id) ?? null;
}

/**
 * Creates a deployment (`id` null) or updates one, replacing its phases, in
 * one transaction. Returns its id, or null when the one being edited is gone.
 */
export async function saveDeployment(
  id: string | null,
  input: DeploymentInput,
  userId: number | null,
): Promise<string | null> {
  const sql = db();
  const deploymentId = id ?? randomUUID();
  const d = input;
  const write = id
    ? sql`
        update deployments set
          name = ${d.name}, status = ${d.status}, nodes = ${d.nodes}, platform = ${d.platform},
          cooling = ${d.cooling}, networking = ${d.networking}, storage_tb_per_node = ${d.storageTbPerNode},
          address = ${d.address}, facility = ${d.facility}, term_months = ${d.termMonths},
          price_gpu_hr = ${d.priceGpuHr}, deposit_usd = ${d.depositUsd}, credit_rating = ${d.creditRating},
          loc_required = ${d.locRequired}, loc_amount_usd = ${d.locAmountUsd},
          credit_guarantee = ${d.creditGuarantee}, lease_guarantee = ${d.leaseGuarantee}, notes = ${d.notes},
          updated_by = ${userId}, updated_at = now()
        where id = ${deploymentId}
        returning id
      `
    : sql`
        insert into deployments (
          id, name, status, nodes, platform, cooling, networking, storage_tb_per_node, address, facility,
          term_months, price_gpu_hr, deposit_usd, credit_rating, loc_required, loc_amount_usd,
          credit_guarantee, lease_guarantee, notes, created_by, updated_by
        ) values (
          ${deploymentId}, ${d.name}, ${d.status}, ${d.nodes}, ${d.platform}, ${d.cooling}, ${d.networking},
          ${d.storageTbPerNode}, ${d.address}, ${d.facility}, ${d.termMonths}, ${d.priceGpuHr}, ${d.depositUsd},
          ${d.creditRating}, ${d.locRequired}, ${d.locAmountUsd}, ${d.creditGuarantee}, ${d.leaseGuarantee},
          ${d.notes}, ${userId}, ${userId}
        )
        returning id
      `;
  // The phase writes only touch rows of a deployment that exists, so an update of a deleted one writes nothing.
  const [written] = await sql.transaction([
    write,
    sql`delete from deployment_phases where deployment_id = ${deploymentId}`,
    ...d.phases.map(
      (phase, position) => sql`
        insert into deployment_phases (deployment_id, position, name, start_on, rfs_on, nodes, mw)
        select id, ${position}, ${phase.name}, ${phase.startOn}, ${phase.rfsOn}, ${phase.nodes}, ${phase.mw}
        from deployments where id = ${deploymentId}
      `,
    ),
  ]);
  return written.length ? deploymentId : null;
}

export async function deleteDeployment(id: string): Promise<void> {
  if (!isUuid(id)) return;
  await db()`delete from deployments where id = ${id}`;
}
