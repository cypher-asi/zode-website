import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { cacheLife, cacheTag } from "next/cache";
import { isUuid } from "@/features/zrm/access";
import { DB_TAG, db } from "@/lib/db";
import { configFromJson } from "@/features/cluster/model/url";
import type { Deployment, Phase, PhaseInput, RoomChoice } from "./types";

/** Every deployment read is cached under this tag, which saving and deleting update. */
export const DEPLOYMENTS_TAG = "deployments";

export type DeploymentInput = Omit<Deployment, "id" | "updatedAt" | "dataRoomName" | "shareToken" | "phases"> & {
  phases: PhaseInput[];
};

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
  city: row.city == null ? null : String(row.city),
  placeId: row.place_id == null ? null : String(row.place_id),
  facility: (row.facility ?? null) as Deployment["facility"],
  termMonths: row.term_months == null ? null : Number(row.term_months),
  priceGpuHr: row.price_gpu_hr == null ? null : Number(row.price_gpu_hr),
  depositPct: row.deposit_pct == null ? null : Number(row.deposit_pct),
  depositUsd: row.deposit_usd == null ? null : Number(row.deposit_usd),
  creditRating: (row.credit_rating ?? null) as Deployment["creditRating"],
  locRequired: Boolean(row.loc_required),
  locYears: row.loc_years == null ? null : Number(row.loc_years),
  creditGuarantee: Boolean(row.credit_guarantee),
  leaseGuarantee: Boolean(row.lease_guarantee),
  notes: row.notes == null ? null : String(row.notes),
  externalNotes: row.external_notes == null ? null : String(row.external_notes),
  dataRoomId: row.data_room_id == null ? null : String(row.data_room_id),
  dataRoomName: row.data_room_name == null ? null : String(row.data_room_name),
  shareToken: row.share_token == null ? null : String(row.share_token),
  phases: ((row.phases as Phase[]) ?? []).map((phase) => ({ ...phase, clusterConfig: configFromJson(phase.clusterConfig) })),
  updatedAt: new Date(row.updated_at as string | Date).toISOString(),
});

/** Every deployment, active ones first, then planned, then completed. Shared by everyone, so cached on the server. */
export async function listDeployments(): Promise<Deployment[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(DEPLOYMENTS_TAG, DB_TAG);
  const rows = await db()`
    select d.id, d.name, d.status, d.nodes, d.platform, d.cooling, d.networking, d.storage_tb_per_node,
      d.address, d.city, d.place_id, d.facility, d.term_months, d.price_gpu_hr::float8 as price_gpu_hr,
      d.deposit_pct::float8 as deposit_pct, d.deposit_usd::float8 as deposit_usd, d.credit_rating, d.loc_required,
      d.loc_years::float8 as loc_years, d.credit_guarantee, d.lease_guarantee, d.notes, d.external_notes, d.updated_at,
      d.data_room_id, dr.name as data_room_name, d.share_token,
      coalesce(
        (select json_agg(
            json_build_object(
              'id', p.id, 'name', p.name, 'platform', p.platform, 'startOn', p.start_on::text, 'rfsOn', p.rfs_on::text,
              'nodes', p.nodes, 'mw', p.mw::float8, 'clusterConfig', p.cluster_config, 'clusterCopies', p.cluster_copies
            ) order by p.rfs_on, p.position)
          from deployment_phases p where p.deployment_id = d.id),
        '[]'::json
      ) as phases
    from deployments d
    left join data_rooms dr on dr.id = d.data_room_id
    order by case d.status when 'active' then 0 when 'planned' then 1 else 2 end, lower(d.name)
  `;
  return rows.map(toDeployment);
}

/** One deployment, from the cached list. */
export async function getDeployment(id: string): Promise<Deployment | null> {
  if (!isUuid(id)) return null;
  return (await listDeployments()).find((deployment) => deployment.id === id) ?? null;
}

const SHARE_TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;

/** A new secret for a deployment's public link. */
export const newShareToken = (): string => randomBytes(24).toString("base64url");

/** The deployment shared under `token`, from the cached list. */
export async function getSharedDeployment(token: string): Promise<Deployment | null> {
  if (!SHARE_TOKEN_RE.test(token)) return null;
  return (await listDeployments()).find((deployment) => deployment.shareToken === token) ?? null;
}

/**
 * Shares deployment `id` under `token`, keeping the token it already has, or
 * stops sharing it with null. Returns its token, or undefined when it's gone.
 */
export async function setShareToken(id: string, token: string | null): Promise<string | null | undefined> {
  if (!isUuid(id)) return undefined;
  const sql = db();
  const rows =
    token === null
      ? await sql`update deployments set share_token = null where id = ${id} returning share_token`
      : await sql`
          update deployments set share_token = coalesce(share_token, ${token})
          where id = ${id}
          returning share_token
        `;
  return rows.length ? ((rows[0].share_token as string | null) ?? null) : undefined;
}

/**
 * Creates a deployment (`id` null) or updates one with its phases, in one
 * transaction. Phases keep their ids, and with them their BOMs; one left out
 * is deleted. Returns its id, or null when the one being edited is gone.
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
          address = ${d.address}, city = ${d.city}, place_id = ${d.placeId}, facility = ${d.facility},
          term_months = ${d.termMonths}, price_gpu_hr = ${d.priceGpuHr}, deposit_pct = ${d.depositPct},
          deposit_usd = ${d.depositUsd},
          credit_rating = ${d.creditRating}, loc_required = ${d.locRequired}, loc_years = ${d.locYears},
          credit_guarantee = ${d.creditGuarantee}, lease_guarantee = ${d.leaseGuarantee}, notes = ${d.notes},
          external_notes = ${d.externalNotes}, data_room_id = ${d.dataRoomId}, updated_by = ${userId}, updated_at = now()
        where id = ${deploymentId}
        returning id
      `
    : sql`
        insert into deployments (
          id, name, status, nodes, platform, cooling, networking, storage_tb_per_node, address, city, place_id,
          facility, term_months, price_gpu_hr, deposit_pct, deposit_usd, credit_rating, loc_required, loc_years,
          credit_guarantee, lease_guarantee, notes, external_notes, data_room_id, created_by, updated_by
        ) values (
          ${deploymentId}, ${d.name}, ${d.status}, ${d.nodes}, ${d.platform}, ${d.cooling}, ${d.networking},
          ${d.storageTbPerNode}, ${d.address}, ${d.city}, ${d.placeId}, ${d.facility}, ${d.termMonths},
          ${d.priceGpuHr}, ${d.depositPct}, ${d.depositUsd}, ${d.creditRating}, ${d.locRequired}, ${d.locYears},
          ${d.creditGuarantee}, ${d.leaseGuarantee}, ${d.notes}, ${d.externalNotes}, ${d.dataRoomId}, ${userId}, ${userId}
        )
        returning id
      `;
  const phases = d.phases.map((phase) => ({ ...phase, id: phase.id ?? randomUUID() }));
  // The phase writes only touch rows of a deployment that exists, so an update of a deleted one writes
  // nothing, and an id from another deployment's phase updates nothing.
  const [written] = await sql.transaction([
    write,
    sql`
      delete from deployment_phases
      where deployment_id = ${deploymentId} and not (id = any(${phases.map((phase) => phase.id)}::uuid[]))
    `,
    ...phases.map(
      (phase, position) => sql`
        insert into deployment_phases (id, deployment_id, position, name, platform, start_on, rfs_on, nodes, mw)
        select ${phase.id}, id, ${position}, ${phase.name}, ${phase.platform}, ${phase.startOn}, ${phase.rfsOn},
          ${phase.nodes}, ${phase.mw}
        from deployments where id = ${deploymentId}
        on conflict (id) do update set
          position = excluded.position, name = excluded.name, platform = excluded.platform,
          start_on = excluded.start_on, rfs_on = excluded.rfs_on, nodes = excluded.nodes, mw = excluded.mw
        where deployment_phases.deployment_id = excluded.deployment_id
      `,
    ),
  ]);
  return written.length ? deploymentId : null;
}

/** Every data room, for the ZODE team to link a deployment to. */
export async function listRoomChoices(): Promise<RoomChoice[]> {
  const rows = await db()`select id, name from data_rooms order by lower(name)`;
  return rows.map((row) => ({ id: String(row.id), name: String(row.name) }));
}

/** Whether data room `id` exists. */
export async function roomExists(id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const rows = await db()`select 1 from data_rooms where id = ${id}`;
  return rows.length > 0;
}

export async function deleteDeployment(id: string): Promise<void> {
  if (!isUuid(id)) return;
  await db()`delete from deployments where id = ${id}`;
}
