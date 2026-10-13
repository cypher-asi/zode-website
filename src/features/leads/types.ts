import type { PortalIconName } from "@/features/portal/icons";

/** Each lead type's page in the Leads app, `/portal/leads/<id>`. */
export const LEAD_TYPES = [
  { id: "buy", label: "Buy compute", pill: "Buy", icon: "cluster" },
  { id: "rent", label: "Rent compute", pill: "Rent", icon: "recurring" },
  { id: "invest", label: "Invest", pill: "Invest", icon: "invest" },
] as const satisfies readonly { id: string; label: string; pill: string; icon: PortalIconName }[];

export type LeadType = (typeof LEAD_TYPES)[number]["id"];

export const isLeadType = (value: unknown): value is LeadType => LEAD_TYPES.some((type) => type.id === value);

export const leadType = (id: LeadType) => LEAD_TYPES.find((type) => type.id === id) ?? LEAD_TYPES[0];

/** Where the team stands with a lead, kept in each source table's `status` column. */
export const LEAD_STATUSES = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "qualified", label: "Qualified" },
  { id: "closed", label: "Closed" },
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number]["id"];

export const isLeadStatus = (value: unknown): value is LeadStatus => LEAD_STATUSES.some((status) => status.id === value);

/** Anything stored before statuses were set from the portal reads as New. */
export const leadStatus = (value: unknown): LeadStatus => (isLeadStatus(value) ? value : "new");

export const statusLabel = (id: LeadStatus): string => LEAD_STATUSES.find((status) => status.id === id)?.label ?? id;

/** An order's status as its customer sees it, without the team's sales stages. */
export function customerOrderStatus(status: string): string {
  if (status === "contacted" || status === "qualified") return "In progress";
  if (status === "closed") return "Closed";
  return status === "new" ? "Received" : status;
}

/** The form a lead came in through: a configurator order, Talk to an Engineer, or Invest. */
export const LEAD_SOURCES = [
  { id: "order", label: "Order", icon: "orders" },
  { id: "engineer", label: "Engineer", icon: "person" },
  { id: "investor", label: "Investor", icon: "invest" },
] as const satisfies readonly { id: string; label: string; icon: PortalIconName }[];

export type LeadSource = (typeof LEAD_SOURCES)[number]["id"];

export const isLeadSource = (value: unknown): value is LeadSource => LEAD_SOURCES.some((source) => source.id === value);

export const leadSource = (id: LeadSource) => LEAD_SOURCES.find((source) => source.id === id) ?? LEAD_SOURCES[0];

export interface Lead {
  source: LeadSource;
  /** The row's uuid in its source table. */
  id: string;
  /** The short reference the submitter was shown. */
  reference: string;
  /** Buy, rent or both for compute leads; invest for investors. */
  types: LeadType[];
  status: LeadStatus;
  createdAt: Date;
  name: string;
  email: string;
  /** Company, company website or firm, whichever the form asked for. */
  organization: string | null;
  title: string | null;
  phone: string | null;
  /** What they asked for, e.g. "64 GPUs · B300 · Phoenix · $1.2M total". */
  summary: string;
}

export interface LeadStatusResult {
  readonly error?: string;
}
