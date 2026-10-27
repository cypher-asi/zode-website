import { HONEYPOT_FIELD } from "@/lib/leads";
import { isEmail, multiLine, singleLine } from "@/lib/validation";

/** The counterparty to the agreement and the person signing for it. */
export interface MndaParty {
  entityName: string;
  /** Completes "a ___", e.g. "Delaware limited liability company". */
  entityType: string;
  entityAddress: string;
  signerName: string;
  signerTitle: string;
  signerEmail: string;
}

/** Sized so each value still fits its blank on the template, at worst on two small lines. */
export const FIELD_LIMITS = {
  entityName: 100,
  entityType: 80,
  entityAddress: 300,
  signerName: 120,
  signerTitle: 120,
} as const;

/** The signature page has three address lines. */
export const MAX_ADDRESS_LINES = 3;

export type ParsedMnda =
  | {
      ok: true;
      party: MndaParty;
      /** The version of the agreement the form was showing. */
      templateVersion: string;
      spam: boolean;
    }
  | { ok: false; error: string };

const field = (formData: FormData, name: string): string => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

/** Compares a typed signature with the printed name, ignoring case and spacing. */
const sameName = (a: string, b: string): boolean =>
  a.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim() ===
  b.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Reads the signing form. `lockedEmail`, when set, is the signer's address
 * whatever the form says: the data room flow already proved it.
 */
export function parseMnda(formData: FormData, lockedEmail?: string): ParsedMnda {
  const entityName = singleLine(field(formData, "entityName"));
  const entityType = singleLine(field(formData, "entityType"));
  const entityAddress = multiLine(field(formData, "entityAddress"))
    .split("\n")
    .map((line) => singleLine(line))
    .filter(Boolean)
    .join("\n");
  const signerName = singleLine(field(formData, "signerName"));
  const signerTitle = singleLine(field(formData, "signerTitle"));
  const signerEmail = (lockedEmail ?? singleLine(field(formData, "signerEmail"))).toLowerCase();
  const signature = singleLine(field(formData, "signature"));

  if (!entityName) return { ok: false, error: "Enter the entity's legal name." };
  if (entityName.length > FIELD_LIMITS.entityName) return { ok: false, error: "The entity name is too long." };
  if (!entityType) return { ok: false, error: "Enter what kind of entity it is, e.g. a Delaware corporation." };
  if (entityType.length > FIELD_LIMITS.entityType) return { ok: false, error: "The entity type is too long." };
  if (!entityAddress) return { ok: false, error: "Enter the entity's address for notices." };
  if (entityAddress.length > FIELD_LIMITS.entityAddress || entityAddress.split("\n").length > MAX_ADDRESS_LINES) {
    return { ok: false, error: `Keep the address to ${MAX_ADDRESS_LINES} short lines.` };
  }
  if (!signerName) return { ok: false, error: "Enter your full name." };
  if (signerName.length > FIELD_LIMITS.signerName) return { ok: false, error: "Your name is too long." };
  if (!signerTitle) return { ok: false, error: "Enter your title." };
  if (signerTitle.length > FIELD_LIMITS.signerTitle) return { ok: false, error: "Your title is too long." };
  if (!isEmail(signerEmail)) return { ok: false, error: "Enter a valid email address." };
  if (!signature) return { ok: false, error: "Type your full name to sign." };
  if (!sameName(signature, signerName)) return { ok: false, error: "Your signature must match your full name." };
  if (formData.get("consent") !== "on") {
    return { ok: false, error: "Confirm that you're authorized to sign and agree to sign electronically." };
  }

  return {
    ok: true,
    party: { entityName, entityType, entityAddress, signerName, signerTitle, signerEmail },
    templateVersion: field(formData, "templateVersion"),
    spam: field(formData, HONEYPOT_FIELD) !== "",
  };
}
