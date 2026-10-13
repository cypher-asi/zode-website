import "server-only";
import { isUuid } from "@/features/data-room/rooms";
import { db } from "@/lib/db";

/** Every compute contract's PDF is stored under this prefix in the private Blob store. */
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

/** A compute purchase or rental, signed elsewhere and recorded by the ZODE team. */
export interface ComputeContract extends ContractBase {
  kind: "compute";
  mode: "buy" | "rent";
  itMw: number | null;
  valueUsd: number | null;
  monthlyUsd: number | null;
  termMonths: number | null;
  opportunityTitle: string | null;
  siteName: string | null;
}

/** An executed agreement between ZODE and a counterparty. */
export type Contract = MndaContract | ComputeContract;

export type ContractKind = Contract["kind"];

const num = (value: unknown): number | null => (value == null ? null : Number(value));

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
const toCompute = (row: Record<string, unknown>): ComputeContract => ({
  id: String(row.id),
  kind: "compute",
  counterparty: String(row.counterparty),
  signedAt: new Date(`${String(row.signed_on)}T12:00:00Z`),
  mode: row.mode === "rent" ? "rent" : "buy",
  itMw: num(row.it_mw),
  valueUsd: num(row.value_usd),
  monthlyUsd: num(row.monthly_usd),
  termMonths: num(row.term_months),
  opportunityTitle: row.opportunity_title == null ? null : String(row.opportunity_title),
  siteName: row.site_name == null ? null : String(row.site_name),
});

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

/** Every agreement, MNDAs and compute contracts together, newest first. For the ZODE team only. */
export async function listAllContracts(): Promise<Contract[]> {
  const [mndas, compute] = await Promise.all([
    db()`
      select m.id, m.entity_name, m.signer_name, m.signer_title, m.signer_email, m.signed_at, m.user_id, r.name as room_name
      from mndas m
      left join data_rooms r on r.id = m.room_id
    `,
    db()`
      select c.id, c.counterparty, c.signed_at::text as signed_on, c.mode, c.it_mw, c.value_usd, c.monthly_usd,
        c.term_months, o.title as opportunity_title, s.name as site_name
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

/** The ZRM opportunities and Capacity sites a compute contract can be linked to, by name. */
export async function listContractLinks(): Promise<{ opportunities: LinkOption[]; sites: LinkOption[] }> {
  const [opportunities, sites] = await Promise.all([
    db()`
      select o.id, o.title, c.name as company_name
      from zrm_opportunities o
      left join zrm_companies c on c.id = o.company_id
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

export interface ComputeContractInput {
  signedOn: string;
  counterparty: string;
  mode: "buy" | "rent";
  opportunityId: string | null;
  siteId: string | null;
  itMw: number | null;
  valueUsd: number | null;
  monthlyUsd: number | null;
  termMonths: number | null;
  notes: string | null;
  blobPathname: string;
  recordedBy: number | null;
}

/** Whether a compute contract already holds this PDF, so a failed form never deletes a recorded one. */
export async function isRecordedContractBlob(pathname: string): Promise<boolean> {
  const [row] = await db()`select 1 from compute_contracts where blob_pathname = ${pathname}`;
  return Boolean(row);
}

/** Records a compute contract; its company is the opportunity's, or else the site's customer. */
export async function createComputeContract(input: ComputeContractInput): Promise<string> {
  const [row] = await db()`
    insert into compute_contracts (
      signed_at, counterparty, mode, company_id, opportunity_id, site_id,
      it_mw, value_usd, monthly_usd, term_months, notes, blob_pathname, recorded_by
    ) values (
      ${input.signedOn}, ${input.counterparty}, ${input.mode},
      coalesce(
        (select company_id from zrm_opportunities where id = ${input.opportunityId}),
        (select customer_company_id from capacity_sites where id = ${input.siteId})
      ),
      ${input.opportunityId}, ${input.siteId},
      ${input.itMw}, ${input.valueUsd}, ${input.monthlyUsd}, ${input.termMonths}, ${input.notes},
      ${input.blobPathname}, ${input.recordedBy}
    )
    returning id
  `;
  return String(row!.id);
}

export interface ContractFile {
  kind: ContractKind;
  /** The ZOS account an MNDA is bound to; compute contracts belong to no account. */
  userId: string | null;
  counterparty: string;
  blobPathname: string;
}

/** Where an agreement's executed PDF is stored, and whose it is, so callers can check access. */
export async function getContractFile(id: string): Promise<ContractFile | null> {
  if (!isUuid(id)) return null;
  const [row] = await db()`
    select 'mnda' as kind, user_id, entity_name as counterparty, blob_pathname from mndas where id = ${id}
    union all
    select 'compute', null, counterparty, blob_pathname from compute_contracts where id = ${id}
  `;
  return row
    ? {
        kind: row.kind === "compute" ? "compute" : "mnda",
        userId: row.user_id == null ? null : String(row.user_id),
        counterparty: String(row.counterparty),
        blobPathname: String(row.blob_pathname),
      }
    : null;
}

/** The download name of an executed agreement, e.g. "ZODE - MNDA - Acme Inc.pdf". */
export const contractFileName = (kind: ContractKind, counterparty: string): string =>
  `ZODE - ${kind === "compute" ? "Compute Contract" : "MNDA"} - ${
    counterparty.replace(/[^\p{L}\p{N} .,&-]+/gu, "").trim().slice(0, 80) || "Entity"
  }.pdf`;
