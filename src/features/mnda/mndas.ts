import "server-only";
import { randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";
import { clientMeta } from "@/lib/clientMeta";
import { db } from "@/lib/db";
import { RECIPIENT_EMAIL } from "@/lib/leads";
import { TEMPLATE_VERSION } from "./agreement";
import type { MndaParty } from "./parse";
import { renderExecutedMnda } from "./pdf";

export interface ZodeSigner {
  name: string;
  title: string;
}

/**
 * The officer whose signature ZODE applies to every MNDA, from
 * MNDA_ZODE_SIGNER_NAME and MNDA_ZODE_SIGNER_TITLE. Outside local development
 * an unset signer means nothing can be signed.
 */
export function zodeSigner(): ZodeSigner | null {
  const name = process.env.MNDA_ZODE_SIGNER_NAME?.trim();
  const title = process.env.MNDA_ZODE_SIGNER_TITLE?.trim();
  if (name && title) return { name, title };
  return process.env.NODE_ENV === "development" ? { name: "Local Signatory", title: "Development only" } : null;
}

export interface ExecutedMnda {
  id: string;
  party: MndaParty;
  zodeSigner: ZodeSigner;
  signedAt: Date;
  pdf: Uint8Array;
}

/** Thrown when the ZODE countersigner isn't configured, so callers can say so rather than fail generically. */
export class MndaUnavailableError extends Error {}

/** Logs a failed signing and returns what to tell the signer. */
export function signFailure(err: unknown): string {
  console.error("[mnda] could not execute agreement:", err);
  return err instanceof MndaUnavailableError
    ? `Online signing isn't available right now. Email ${RECIPIENT_EMAIL} and we'll send the MNDA over.`
    : `We couldn't complete the signing just now. Please try again, or email ${RECIPIENT_EMAIL}.`;
}

/**
 * Executes an MNDA: stamps both signatures onto the template, stores the PDF
 * in the private Blob store and records it. `userId` binds it to the ZOS
 * account that signed, which is what data room invites check.
 */
export async function createMnda(
  party: MndaParty,
  context: { userId: string | null; room: { id: string; name: string } | null },
): Promise<ExecutedMnda> {
  const signer = zodeSigner();
  if (!signer) throw new MndaUnavailableError("MNDA_ZODE_SIGNER_NAME and MNDA_ZODE_SIGNER_TITLE are not set");

  const id = randomUUID();
  const signedAt = new Date();
  const { ip, userAgent } = await clientMeta();
  const { bytes, sha256 } = await renderExecutedMnda({
    id,
    party,
    zodeSigner: signer,
    signedAt,
    ip,
    userAgent,
    method:
      context.room && context.userId
        ? { kind: "data-room", roomName: context.room.name, userId: context.userId }
        : { kind: "public" },
  });

  const pathname = `mndas/${id}.pdf`;
  await put(pathname, Buffer.from(bytes), {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/pdf",
  });
  try {
    await db()`
      insert into mndas (
        id, signed_at, template_version, entity_name, entity_type, entity_address,
        signer_name, signer_title, signer_email, user_id, room_id,
        zode_signer_name, zode_signer_title, blob_pathname, pdf_sha256, ip, user_agent
      ) values (
        ${id}, ${signedAt}, ${TEMPLATE_VERSION}, ${party.entityName}, ${party.entityType}, ${party.entityAddress},
        ${party.signerName}, ${party.signerTitle}, ${party.signerEmail}, ${context.userId}, ${context.room?.id ?? null},
        ${signer.name}, ${signer.title}, ${pathname}, ${sha256}, ${ip}, ${userAgent}
      )
    `;
  } catch (error) {
    await del(pathname).catch(() => {});
    throw error;
  }

  return { id, party, zodeSigner: signer, signedAt, pdf: bytes };
}

/** Whether this ZOS account has signed an MNDA while logged in. */
export async function hasSignedMnda(userId: string): Promise<boolean> {
  const [row] = await db()`select 1 from mndas where user_id = ${userId} limit 1`;
  return Boolean(row);
}
