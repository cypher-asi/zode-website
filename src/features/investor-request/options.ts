/** Choices on the Invest form, shared by the form and the server-side parser. */

export const INVESTOR_TYPES = [
  { id: "vc", label: "Venture Capital" },
  { id: "pe", label: "Private Equity" },
  { id: "project-finance", label: "Project Finance" },
  { id: "infrastructure", label: "Infrastructure Fund" },
  { id: "family-office", label: "Family Office" },
  { id: "angel", label: "Angel" },
  { id: "strategic", label: "Strategic / Corporate" },
  { id: "institutional", label: "Sovereign / Institutional" },
  { id: "other", label: "Other" },
] as const;

export type InvestorTypeId = (typeof INVESTOR_TYPES)[number]["id"];

export const OPPORTUNITIES = [
  { id: "equity", label: "Company Equity", detail: "Invest in ZODE, the company" },
  { id: "project", label: "Project Finance", detail: "Fund ZODE deployments backed by their compute revenue" },
] as const;

export type OpportunityId = (typeof OPPORTUNITIES)[number]["id"];

export const CHECK_SIZES = [
  { id: "under-250k", label: "Under $250K" },
  { id: "250k-1m", label: "$250K–$1M" },
  { id: "1m-5m", label: "$1M–$5M" },
  { id: "5m-25m", label: "$5M–$25M" },
  { id: "25m-100m", label: "$25M–$100M" },
  { id: "100m-plus", label: "$100M+" },
] as const;

export type CheckSizeId = (typeof CHECK_SIZES)[number]["id"];

/**
 * Contact fields in form order, with the limits the server enforces. The
 * website field is `firmWebsite`: `website` is the honeypot (see lib/leads.ts).
 */
export const CONTACT_FIELDS = [
  { key: "name", label: "Name", required: true, max: 120 },
  { key: "email", label: "Email", required: true, max: 200 },
  { key: "firm", label: "Firm", required: false, max: 160 },
  { key: "title", label: "Title", required: false, max: 120 },
  { key: "firmWebsite", label: "Firm website", required: false, max: 200 },
  { key: "phone", label: "Phone number", required: false, max: 40 },
] as const;

export type ContactKey = (typeof CONTACT_FIELDS)[number]["key"];

export const NOTE_MAX = 1000;

export const investorTypeLabel = (id: string): string => INVESTOR_TYPES.find((t) => t.id === id)?.label ?? id;
export const opportunityLabel = (id: string): string => OPPORTUNITIES.find((o) => o.id === id)?.label ?? id;
export const checkSizeLabel = (id: string): string => CHECK_SIZES.find((s) => s.id === id)?.label ?? id;
