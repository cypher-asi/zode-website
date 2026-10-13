import "server-only";
import {
  CHECK_SIZES,
  CONTACT_FIELDS,
  INVESTOR_TYPES,
  NOTE_MAX,
  OPPORTUNITIES,
  type CheckSizeId,
  type ContactKey,
  type InvestorTypeId,
  type OpportunityId,
} from "./options";
import { PHONE_RE, phoneDigits } from "@/features/engineer-request/options";
import { db } from "@/lib/db";
import { HONEYPOT_FIELD } from "@/lib/leads";
import { isEmail, multiLine, singleLine } from "@/lib/validation";
import { referenceFor } from "@/features/configurator/orders";

export type InvestorRequest = Record<ContactKey, string> & {
  investorType: InvestorTypeId;
  opportunities: OpportunityId[];
  checkSize: CheckSizeId;
  note: string;
};

export type ParsedInvestorRequest =
  | { ok: true; spam: false; request: InvestorRequest }
  | { ok: true; spam: true; request: InvestorRequest }
  | { ok: false; error: string };

/** Validates an Invest submission, accepting only the offered choices. */
export function parseInvestorRequest(formData: FormData): ParsedInvestorRequest {
  const investorType = INVESTOR_TYPES.find((t) => t.id === formData.get("investorType"))?.id;
  if (!investorType) return { ok: false, error: "Choose the kind of investor you are." };

  const picked = formData.getAll("opportunity");
  const opportunities = OPPORTUNITIES.filter((o) => picked.includes(o.id)).map((o) => o.id);
  if (opportunities.length === 0) return { ok: false, error: "Choose company equity, project finance, or both." };

  const checkSize = CHECK_SIZES.find((s) => s.id === formData.get("checkSize"))?.id;
  if (!checkSize) return { ok: false, error: "Choose a typical check size." };

  const contact = {} as Record<ContactKey, string>;
  for (const field of CONTACT_FIELDS) {
    const raw = formData.get(field.key);
    const value = typeof raw === "string" ? singleLine(raw) : "";
    if (field.required && !value) return { ok: false, error: `${field.label} is required.` };
    if (value.length > field.max) return { ok: false, error: `${field.label} is too long.` };
    contact[field.key] = value;
  }
  if (!isEmail(contact.email)) return { ok: false, error: "That email doesn't look right." };
  if (contact.phone) {
    const digits = phoneDigits(contact.phone);
    if (!PHONE_RE.test(contact.phone) || digits < 7 || digits > 15) {
      return { ok: false, error: "That phone number doesn't look right." };
    }
  }

  const rawNote = formData.get("note");
  const note = typeof rawNote === "string" ? multiLine(rawNote) : "";
  if (note.length > NOTE_MAX) return { ok: false, error: "That note is too long." };

  const request = { ...contact, investorType, opportunities, checkSize, note };
  const honey = formData.get(HONEYPOT_FIELD);
  const spam = typeof honey === "string" && honey.trim() !== "";
  return spam ? { ok: true, spam: true, request } : { ok: true, spam: false, request };
}

/** Stores the request and returns its short reference. */
export async function createInvestorRequest(request: InvestorRequest): Promise<string> {
  const { investorType, opportunities, checkSize, name, email, firm, title, firmWebsite, phone, note } = request;
  const [row] = await db()`
    insert into investor_requests (investor_type, opportunities, check_size, name, email, firm, title, website, phone, note)
    values (
      ${investorType}, ${opportunities}, ${checkSize}, ${name}, ${email},
      ${firm || null}, ${title || null}, ${firmWebsite || null}, ${phone || null}, ${note || null}
    )
    returning id
  `;
  return referenceFor(String(row.id));
}
