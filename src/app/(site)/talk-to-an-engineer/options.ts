/** Choices on the Talk to an Engineer form, shared by the form and the server-side parser. */

export const INTERESTS = [
  { id: "buy", label: "Buying Compute", detail: "Own a ZODE, deployed on your site" },
  { id: "rent", label: "Renting Compute", detail: "Reserve a cluster on the ZODE network" },
] as const;

export type InterestId = (typeof INTERESTS)[number]["id"];

export const DEPLOYMENT_SIZES = [
  { id: "under-16", label: "Under 16" },
  { id: "16-64", label: "16–64" },
  { id: "64-256", label: "64–256" },
  { id: "256-1024", label: "256–1,024" },
  { id: "1024-plus", label: "1,024+" },
  { id: "unsure", label: "Not sure yet" },
] as const;

export type DeploymentSizeId = (typeof DEPLOYMENT_SIZES)[number]["id"];

/**
 * Contact fields in form order, with the limits the server enforces. The
 * website field is `company`: `website` is the honeypot (see lib/leads.ts).
 */
export const CONTACT_FIELDS = [
  { key: "company", label: "Company website", required: false, max: 200 },
  { key: "name", label: "Name", required: true, max: 120 },
  { key: "title", label: "Title", required: false, max: 120 },
  { key: "phone", label: "Phone number", required: true, max: 40 },
  { key: "email", label: "Email", required: true, max: 200 },
] as const;

export type ContactKey = (typeof CONTACT_FIELDS)[number]["key"];

/** Digits in a phone number, ignoring spaces, dashes, dots, brackets and a leading +. */
export const phoneDigits = (phone: string): number => phone.replace(/\D/g, "").length;

export const PHONE_RE = /^\+?[\d\s().-]+$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const interestLabel = (id: string): string => INTERESTS.find((i) => i.id === id)?.label ?? id;
export const sizeLabel = (id: string): string => DEPLOYMENT_SIZES.find((s) => s.id === id)?.label ?? id;
