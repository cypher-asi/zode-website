import "server-only";
import { isUuid } from "@/features/data-room/rooms";
import { db } from "@/lib/db";

/** An executed agreement between ZODE and a counterparty. Only MNDAs so far. */
export interface Contract {
  id: string;
  kind: "mnda";
  /** The counterparty entity. */
  counterparty: string;
  signerName: string;
  signerTitle: string;
  signerEmail: string;
  signedAt: Date;
  /** The data room whose invite it was signed from, if any. */
  roomName: string | null;
  /** Bound to the ZOS account that signed it; unbound ones show only to admins. */
  linked: boolean;
}

const toContract = (row: Record<string, unknown>): Contract => ({
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

/** Agreements this ZOS account signed, newest first. Matched by account, never by email. */
export async function listContractsForUser(userId: string): Promise<Contract[]> {
  const rows = await db()`
    select m.id, m.entity_name, m.signer_name, m.signer_title, m.signer_email, m.signed_at, m.user_id, r.name as room_name
    from mndas m
    left join data_rooms r on r.id = m.room_id
    where m.user_id = ${userId}
    order by m.signed_at desc
  `;
  return rows.map(toContract);
}

/** Every agreement anyone has signed, newest first. For ZODE admins only. */
export async function listAllContracts(): Promise<Contract[]> {
  const rows = await db()`
    select m.id, m.entity_name, m.signer_name, m.signer_title, m.signer_email, m.signed_at, m.user_id, r.name as room_name
    from mndas m
    left join data_rooms r on r.id = m.room_id
    order by m.signed_at desc
  `;
  return rows.map(toContract);
}

export interface ContractFile {
  userId: string | null;
  counterparty: string;
  blobPathname: string;
}

/** Where an agreement's executed PDF is stored, and whose it is, so callers can check access. */
export async function getContractFile(id: string): Promise<ContractFile | null> {
  if (!isUuid(id)) return null;
  const [row] = await db()`select user_id, entity_name, blob_pathname from mndas where id = ${id}`;
  return row
    ? {
        userId: row.user_id == null ? null : String(row.user_id),
        counterparty: String(row.entity_name),
        blobPathname: String(row.blob_pathname),
      }
    : null;
}
