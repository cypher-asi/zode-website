import "server-only";
import {
  CONTACT_FIELDS,
  DEPLOYMENT_SIZES,
  EMAIL_RE,
  INTERESTS,
  PHONE_RE,
  phoneDigits,
  type ContactKey,
  type DeploymentSizeId,
  type InterestId,
} from "./options";
import { db } from "@/lib/db";
import { HONEYPOT_FIELD } from "@/lib/leads";
import { referenceFor } from "@/features/configurator/orders";

export type EngineerRequest = Record<ContactKey, string> & {
  interests: InterestId[];
  deploymentSize: DeploymentSizeId;
};

export type ParsedEngineerRequest =
  | { ok: true; spam: false; request: EngineerRequest }
  | { ok: true; spam: true; request: EngineerRequest }
  | { ok: false; error: string };

/** Validates a Talk to an Engineer submission, accepting only the offered choices. */
export function parseEngineerRequest(formData: FormData): ParsedEngineerRequest {
  const picked = formData.getAll("interest");
  const interests = INTERESTS.filter((i) => picked.includes(i.id)).map((i) => i.id);
  if (interests.length === 0) return { ok: false, error: "Choose buying, renting, or both." };

  const deploymentSize = DEPLOYMENT_SIZES.find((s) => s.id === formData.get("size"))?.id;
  if (!deploymentSize) return { ok: false, error: "Choose a deployment size." };

  const contact = {} as Record<ContactKey, string>;
  for (const field of CONTACT_FIELDS) {
    const raw = formData.get(field.key);
    const value = typeof raw === "string" ? raw.trim() : "";
    if (field.required && !value) return { ok: false, error: `${field.label} is required.` };
    if (value.length > field.max) return { ok: false, error: `${field.label} is too long.` };
    contact[field.key] = value;
  }
  if (!EMAIL_RE.test(contact.email)) return { ok: false, error: "That email doesn't look right." };
  const digits = phoneDigits(contact.phone);
  if (!PHONE_RE.test(contact.phone) || digits < 7 || digits > 15) {
    return { ok: false, error: "That phone number doesn't look right." };
  }

  const request = { ...contact, interests, deploymentSize };
  const honey = formData.get(HONEYPOT_FIELD);
  const spam = typeof honey === "string" && honey.trim() !== "";
  return spam ? { ok: true, spam: true, request } : { ok: true, spam: false, request };
}

/** Stores the request and returns its short reference. */
export async function createEngineerRequest(request: EngineerRequest): Promise<string> {
  const { interests, deploymentSize, name, title, company, phone, email } = request;
  const [row] = await db()`
    insert into engineer_requests (interests, deployment_size, name, title, website, phone, email)
    values (${interests}, ${deploymentSize}, ${name}, ${title || null}, ${company || null}, ${phone}, ${email})
    returning id
  `;
  return referenceFor(String(row.id));
}
