import "server-only";
import { randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";
import { clientMeta } from "@/lib/clientMeta";
import { db } from "@/lib/db";
import { RECIPIENT_EMAIL } from "@/lib/leads";
import type { MndaParty } from "./parse";
import { renderExecutedMnda } from "./pdf";
import { CURRENT_TEMPLATE } from "./templates";

export interface ZodeSigner {
  name: string;
  title: string;
}

/** The officer whose signature ZODE applies to every MNDA. */
export const ZODE_SIGNER: ZodeSigner = { name: "Matthew Dorey", title: "CEO" };

export interface ExecutedMnda {
  id: string;
  party: MndaParty;
  zodeSigner: ZodeSigner;
  signedAt: Date;
  pdf: Uint8Array;
}

/** The signer reviewed a version of the agreement that's since been replaced. */
class StaleTemplateError extends Error {
  constructor() {
    super("The agreement was updated since you opened this page. Reload to review the current version, then sign.");
  }
}

/** Logs a failed signing and returns what to tell the signer. */
export function signFailure(err: unknown): string {
  if (err instanceof StaleTemplateError) return err.message;
  console.error("[mnda] could not execute agreement:", err);
  return `We couldn't complete the signing just now. Please try again, or email ${RECIPIENT_EMAIL}.`;
}

/**
 * Executes an MNDA: stamps both signatures onto the template, stores the PDF
 * in the private Blob store and records it. `userId` binds it to the ZOS
 * account that signed, which is what data room invites check. `templateVersion`
 * is the version the signer reviewed, and must still be the current one.
 */
export async function createMnda(
  party: MndaParty,
  templateVersion: string,
  context: { userId: string | null; room: { id: string; name: string } | null },
): Promise<ExecutedMnda> {
  const template = CURRENT_TEMPLATE;
  if (templateVersion !== template.version) throw new StaleTemplateError();
  const signer = ZODE_SIGNER;
  const id = randomUUID();
  const signedAt = new Date();
  const { ip, userAgent } = await clientMeta();
  const { bytes, sha256 } = await renderExecutedMnda({
    id,
    template,
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
        ${id}, ${signedAt}, ${template.version}, ${party.entityName}, ${party.entityType}, ${party.entityAddress},
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
