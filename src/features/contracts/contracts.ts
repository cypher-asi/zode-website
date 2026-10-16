import "server-only";
import { isUuid } from "@/features/data-room/rooms";
import { db } from "@/lib/db";
import { isDealStructure, monthlyCommitment, type DealStructure } from "./deals";

/** Every compute deal's PDFs are stored under this prefix in the private Blob store. */
export const COMPUTE_CONTRACT_PREFIX = "contracts/compute/";

interface ContractBase {
  id: string;
  /** The counterparty entity. */
  counterparty: string;
  signedAt: Date;
}

/** A mutual NDA, signed in the portal from the template. */
export interface MndaContract extends ContractBase {
  kind: "mnda";
  signerName: string;
  signerTitle: string;
  signerEmail: string;
  /** The data room whose invite it was signed from, if any. */
  roomName: string | null;
  /** Bound to the ZOS account that signed it; unbound ones show only to the team. */
  linked: boolean;
}

/** One of a compute deal's executed PDFs, e.g. its MSA or an order form. */
export interface ContractDocument {
  id: string;
  label: string;
}

/**
 * A compute deal: a closed Compute opportunity's executed MSA and order
 * forms, signed elsewhere and recorded by the ZODE team. Dates are `YYYY-MM-DD`.
 */
export interface ComputeContract extends ContractBase {
  kind: "compute";
  /** The ZODE entity that runs the cluster, e.g. ZODE SUPER CLUSTER A LLC. */
  providerEntity: string | null;
  effectiveOn: string | null;
  msaOn: string | null;
  gpuModel: string | null;
  gpuCount: number | null;
  nodeCount: number | null;
  itMw: number | null;
  location: string | null;
  gpuHourUsd: number | null;
  termMonths: number | null;
  renewalMonths: number | null;
  /** The total contract value over the initial term. */
  valueUsd: number | null;
  /** GPUs × rate × 730 hours. */
  monthlyUsd: number | null;
  prepaymentUsd: number | null;
  prepaymentDueOn: string | null;
  deliveryOn: string | null;
  acceptanceDeadlineOn: string | null;
  structure: DealStructure | null;
  uptimePct: number | null;
  opportunityTitle: string | null;
  siteName: string | null;
  documents: ContractDocument[];
}

/** An executed agreement between ZODE and a counterparty. */
export type Contract = MndaContract | ComputeContract;

export type ContractKind = Contract["kind"];

const num = (value: unknown): number | null => (value == null ? null : Number(value));
const str = (value: unknown): string | null => (value == null ? null : String(value));

const toMnda = (row: Record<string, unknown>): MndaContract => ({
  id: String(row.id),
  kind: "mnda",
  counterparty: String(row.entity_name),
  signerName: String(row.signer_name),
  signerTitle: String(row.signer_title),
  signerEmail: String(row.signer_email),
  signedAt: new Date(row.signed_at as string | Date),
  roomName: row.room_name == null ? null : String(row.room_name),
  linked: row.user_id != null,
});

// Noon UTC, so the calendar date reads the same in every US timezone.
const toCompute = (row: Record<string, unknown>): ComputeContract => {
  const gpuCount = num(row.gpu_count);
  const gpuHourUsd = num(row.gpu_hour_usd);
  return {
    id: String(row.id),
    kind: "compute",
    counterparty: String(row.counterparty),
    signedAt: new Date(`${String(row.signed_on)}T12:00:00Z`),
    providerEntity: str(row.provider_entity),
    effectiveOn: str(row.effective_on),
    msaOn: str(row.msa_on),
    gpuModel: str(row.gpu_model),
    gpuCount,
    nodeCount: num(row.node_count),
    itMw: num(row.it_mw),
    location: str(row.location),
    gpuHourUsd,
    termMonths: num(row.term_months),
    renewalMonths: num(row.renewal_months),
    valueUsd: num(row.value_usd),
    monthlyUsd: monthlyCommitment(gpuCount, gpuHourUsd),
    prepaymentUsd: num(row.prepayment_usd),
    prepaymentDueOn: str(row.prepayment_due_on),
    deliveryOn: str(row.delivery_on),
    acceptanceDeadlineOn: str(row.acceptance_deadline_on),
    structure: isDealStructure(row.structure) ? row.structure : null,
    uptimePct: num(row.uptime_pct),
    opportunityTitle: str(row.opportunity_title),
    siteName: str(row.site_name),
    documents: Array.isArray(row.documents) ? (row.documents as ContractDocument[]) : [],
  };
};

/** Agreements this ZOS account signed, newest first. Matched by account, never by email. */
export async function listContractsForUser(userId: string): Promise<Contract[]> {
  const rows = await db()`
    select m.id, m.entity_name, m.signer_name, m.signer_title, m.signer_email, m.signed_at, m.user_id, r.name as room_name
    from mndas m
    left join data_rooms r on r.id = m.room_id
    where m.user_id = ${userId}
    order by m.signed_at desc
  `;
  return rows.map(toMnda);
}

/** Every agreement, MNDAs and compute deals together, newest first. For the ZODE team only. */
export async function listAllContracts(): Promise<Contract[]> {
  const [mndas, compute] = await Promise.all([
    db()`
      select m.id, m.entity_name, m.signer_name, m.signer_title, m.signer_email, m.signed_at, m.user_id, r.name as room_name
      from mndas m
      left join data_rooms r on r.id = m.room_id
    `,
    db()`
      select c.id, c.counterparty, c.signed_at::text as signed_on, c.provider_entity,
        c.effective_on::text as effective_on, c.msa_on::text as msa_on, c.gpu_model, c.gpu_count, c.node_count,
        c.it_mw, c.location, c.gpu_hour_usd, c.term_months, c.renewal_months, c.value_usd, c.prepayment_usd,
        c.prepayment_due_on::text as prepayment_due_on, c.delivery_on::text as delivery_on,
        c.acceptance_deadline_on::text as acceptance_deadline_on, c.structure, c.uptime_pct,
        o.title as opportunity_title, s.name as site_name,
        coalesce(
          (select json_agg(json_build_object('id', d.id, 'label', d.label) order by d.position, d.created_at)
           from compute_contract_documents d where d.contract_id = c.id),
          '[]'
        ) as documents
      from compute_contracts c
      left join zrm_opportunities o on o.id = c.opportunity_id
      left join capacity_sites s on s.id = c.site_id
    `,
  ]);
  return [...mndas.map(toMnda), ...compute.map(toCompute)].sort((a, b) => b.signedAt.getTime() - a.signedAt.getTime());
}

export interface LinkOption {
  value: string;
  label: string;
  detail?: string;
}

/** The Compute opportunities a deal can close, and the Capacity sites it can run at, by name. */
export async function listContractLinks(): Promise<{ opportunities: LinkOption[]; sites: LinkOption[] }> {
  const [opportunities, sites] = await Promise.all([
    db()`
      select o.id, o.title, c.name as company_name
      from zrm_opportunities o
      left join zrm_companies c on c.id = o.company_id
      where o.deal_type = 'Compute'
      order by lower(o.title)
    `,
    db()`
      select s.id, s.name, s.address
      from capacity_sites s
      order by lower(s.name)
    `,
  ]);
  return {
    opportunities: opportunities.map((row) => ({
      value: String(row.id),
      label: String(row.title),
      detail: row.company_name == null ? undefined : String(row.company_name),
    })),
    sites: sites.map((row) => ({
      value: String(row.id),
      label: String(row.name),
      detail: row.address == null ? undefined : String(row.address),
    })),
  };
}

export interface ComputeDealInput {
  signedOn: string;
  counterparty: string;
  providerEntity: string | null;
  opportunityId: string;
  siteId: string | null;
  effectiveOn: string | null;
  msaOn: string | null;
  gpuModel: string | null;
  gpuCount: number | null;
  nodeCount: number | null;
  itMw: number | null;
  location: string | null;
  gpuHourUsd: number | null;
  termMonths: number | null;
  renewalMonths: number | null;
  valueUsd: number | null;
  prepaymentUsd: number | null;
  prepaymentDueOn: string | null;
  deliveryOn: string | null;
  acceptanceDeadlineOn: string | null;
  structure: DealStructure | null;
  uptimePct: number | null;
  notes: string | null;
  documents: { label: string; blobPathname: string }[];
  recordedBy: number | null;
}

/** Whether a compute deal already holds any of these PDFs, so a failed form never deletes a recorded one. */
export async function isRecordedContractBlob(pathnames: string[]): Promise<boolean> {
  const [row] = await db()`select 1 from compute_contract_documents where blob_pathname = any(${pathnames})`;
  return Boolean(row);
}

/** Whether `id` is a Compute opportunity, the only kind a compute deal closes. */
export async function isComputeOpportunity(id: string): Promise<boolean> {
  const [row] = await db()`select 1 from zrm_opportunities where id = ${id} and deal_type = 'Compute'`;
  return Boolean(row);
}

/**
 * Records a compute deal and its PDFs, and closes its opportunity: the last
 * stage, valued at the deal's total. Its company is the opportunity's, or
 * else the site's customer.
 */
export async function createComputeDeal(input: ComputeDealInput): Promise<string> {
  const id = crypto.randomUUID();
  const sql = db();
  await sql.transaction([
    sql`
      insert into compute_contracts (
        id, signed_at, counterparty, provider_entity, company_id, opportunity_id, site_id,
        effective_on, msa_on, gpu_model, gpu_count, node_count, it_mw, location,
        gpu_hour_usd, term_months, renewal_months, value_usd, prepayment_usd, prepayment_due_on,
        delivery_on, acceptance_deadline_on, structure, uptime_pct, notes, recorded_by
      ) values (
        ${id}, ${input.signedOn}, ${input.counterparty}, ${input.providerEntity},
        coalesce(
          (select company_id from zrm_opportunities where id = ${input.opportunityId}),
          (select customer_company_id from capacity_sites where id = ${input.siteId})
        ),
        ${input.opportunityId}, ${input.siteId},
        ${input.effectiveOn}, ${input.msaOn}, ${input.gpuModel}, ${input.gpuCount}, ${input.nodeCount}, ${input.itMw},
        ${input.location}, ${input.gpuHourUsd}, ${input.termMonths}, ${input.renewalMonths}, ${input.valueUsd},
        ${input.prepaymentUsd}, ${input.prepaymentDueOn}, ${input.deliveryOn}, ${input.acceptanceDeadlineOn},
        ${input.structure}, ${input.uptimePct}, ${input.notes}, ${input.recordedBy}
      )
    `,
    sql`
      insert into compute_contract_documents (contract_id, position, label, blob_pathname)
      select ${id}, d.position - 1, d.label, d.blob_pathname
      from unnest(${input.documents.map((d) => d.label)}::text[], ${input.documents.map((d) => d.blobPathname)}::text[])
        with ordinality as d (label, blob_pathname, position)
    `,
    sql`
      update zrm_opportunities set
        stage_id = (select id from zrm_stages order by position desc limit 1),
        value = coalesce(${input.valueUsd}, value),
        updated_at = now()
      where id = ${input.opportunityId}
    `,
  ]);
  return id;
}

export interface ContractFile {
  kind: ContractKind;
  /** The ZOS account an MNDA is bound to; compute deals belong to no account. */
  userId: string | null;
  counterparty: string;
  /** The document's label, e.g. "MSA"; null for an MNDA. */
  label: string | null;
  blobPathname: string;
}

/**
 * Where an agreement's executed PDF is stored, and whose it is, so callers can
 * check access. A compute deal names one of its documents by `documentId`, or
 * else gives its first.
 */
export async function getContractFile(id: string, documentId: string | null = null): Promise<ContractFile | null> {
  if (!isUuid(id) || (documentId !== null && !isUuid(documentId))) return null;
  const [row] = await db()`
    select 'mnda' as kind, user_id, entity_name as counterparty, null as label, blob_pathname
    from mndas where id = ${id} and ${documentId}::uuid is null
    union all
    select * from (
      select 'compute', null, c.counterparty, d.label, d.blob_pathname
      from compute_contracts c
      join compute_contract_documents d on d.contract_id = c.id
      where c.id = ${id} and (${documentId}::uuid is null or d.id = ${documentId}::uuid)
      order by d.position, d.created_at
      limit 1
    ) as document
  `;
  return row
    ? {
        kind: row.kind === "compute" ? "compute" : "mnda",
        userId: row.user_id == null ? null : String(row.user_id),
        counterparty: String(row.counterparty),
        label: row.label == null ? null : String(row.label),
        blobPathname: String(row.blob_pathname),
      }
    : null;
}

const fileSafe = (text: string, fallback: string): string =>
  text.replace(/[^\p{L}\p{N} .,&-]+/gu, "").trim().slice(0, 80) || fallback;

/** The download name of an executed agreement, e.g. "ZODE - MNDA - Acme Inc.pdf" or "ZODE - Acme Inc - MSA.pdf". */
export const contractFileName = (file: Pick<ContractFile, "kind" | "counterparty" | "label">): string =>
  file.kind === "compute"
    ? `ZODE - ${fileSafe(file.counterparty, "Entity")} - ${fileSafe(file.label ?? "", "Compute Deal")}.pdf`
    : `ZODE - MNDA - ${fileSafe(file.counterparty, "Entity")}.pdf`;
