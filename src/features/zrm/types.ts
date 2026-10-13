/*
 * ZRM records keep their column names (snake_case), so the field specs in
 * fields.ts can address a record, its form inputs and its column alike.
 */

export type ZrmKind = "people" | "companies" | "opportunities";

export const KINDS: readonly ZrmKind[] = ["people", "companies", "opportunities"];

export const isKind = (value: unknown): value is ZrmKind => KINDS.includes(value as ZrmKind);

export const KIND_LABELS: Record<ZrmKind, { plural: string; singular: string }> = {
  people: { plural: "People", singular: "Person" },
  companies: { plural: "Companies", singular: "Company" },
  opportunities: { plural: "Opportunities", singular: "Opportunity" },
};

export const recordHref = (kind: ZrmKind, id: string): string => `/portal/zrm/${kind}/${id}`;

export interface ZrmType {
  id: string;
  name: string;
  color: string;
}

export interface Stage {
  id: string;
  name: string;
  position: number;
}

export interface Option {
  value: string;
  label: string;
}

// List rows: what the middle pane shows and searches.

export interface PersonRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  email: string | null;
  company_id: string | null;
  company_name: string | null;
  active: boolean;
  type_ids: string[];
}

export interface CompanyRow {
  id: string;
  name: string;
  industry: string | null;
  domain: string | null;
  employee_count: number | null;
  country: string | null;
  active: boolean;
  type_ids: string[];
}

export interface OpportunityRow {
  id: string;
  title: string;
  person_id: string | null;
  person_name: string | null;
  company_id: string | null;
  company_name: string | null;
  stage_id: string;
  stage_name: string;
  stage_position: number;
  value: number | null;
  active: boolean;
  type_ids: string[];
}

export type ListRows =
  | { kind: "people"; rows: PersonRow[] }
  | { kind: "companies"; rows: CompanyRow[] }
  | { kind: "opportunities"; rows: OpportunityRow[] };

// Full records, for the detail pane.

export interface Person {
  id: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  seniority: string | null;
  department: string | null;
  email: string | null;
  personal_email: string | null;
  email_status: string | null;
  phone: string | null;
  mobile_phone: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  github_url: string | null;
  company_id: string | null;
  company_name: string | null;
  location: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  headline: string | null;
  bio: string | null;
  photo_url: string | null;
  /** `YYYY-MM-DD`. */
  job_started_at: string | null;
  skills: string[];
  tags: string[];
  active: boolean;
  source: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Company {
  id: string;
  name: string;
  legal_name: string | null;
  domain: string | null;
  website: string | null;
  industry: string | null;
  employee_count: number | null;
  revenue: string | null;
  founded_year: number | null;
  company_type: string | null;
  description: string | null;
  logo_url: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  crunchbase_url: string | null;
  location: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  funding_stage: string | null;
  total_funding: string | null;
  latest_round: string | null;
  latest_valuation: string | null;
  ticker: string | null;
  market_cap: string | null;
  technologies: string[];
  specialties: string[];
  tags: string[];
  active: boolean;
  source: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Opportunity {
  id: string;
  title: string;
  person_id: string | null;
  person_name: string | null;
  company_id: string | null;
  company_name: string | null;
  stage_id: string;
  stage_name: string;
  value: number | null;
  owner_notes: string | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface WorkExperience {
  id: string;
  company: string | null;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface Education {
  id: string;
  school: string | null;
  degree: string | null;
  field: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface CustomField {
  id: string;
  key: string;
  value: string;
}

export interface Activity {
  id: string;
  kind: string;
  note: string;
  at: Date;
}

export interface Note {
  id: string;
  body: string;
  author_email: string | null;
  created_at: Date;
}

/** A linked record in a detail pane's related list. */
export interface Related {
  id: string;
  label: string;
  detail: string | null;
}

export interface ActionState {
  error?: string;
  saved?: boolean;
}

export const personName = (p: { first_name: string | null; last_name: string | null }): string =>
  [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unnamed";

export const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("") || "?";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const formatMoney = (value: number | null): string => (value == null ? "" : money.format(value));
