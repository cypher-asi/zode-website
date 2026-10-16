/*
 * ZRM records keep their column names (snake_case), so the field specs in
 * fields.ts can address a record, its form inputs and its column alike.
 */

export type ZrmKind = "people" | "companies" | "opportunities";

export const KINDS: readonly ZrmKind[] = ["people", "companies", "opportunities"];

export const isKind = (value: unknown): value is ZrmKind => KINDS.includes(value as ZrmKind);

/**
 * Every kind of record the ZRM engine lists and edits: ZRM's own, and
 * Capacity's sites, which sit in their own portal app but link into ZRM.
 */
export type RecordKind = ZrmKind | "sites";

export const isRecordKind = (value: unknown): value is RecordKind => isKind(value) || value === "sites";

/** The portal apps built on the engine, each with its base path and the kinds it has tabs for. */
export type RecordAppId = "zrm" | "capacity";

export const RECORD_APPS: Record<RecordAppId, { base: string; kinds: readonly RecordKind[] }> = {
  zrm: { base: "/portal/zrm", kinds: KINDS },
  capacity: { base: "/portal/capacity", kinds: ["sites"] },
};

const appOf = (kind: RecordKind): RecordAppId => (kind === "sites" ? "capacity" : "zrm");

export const KIND_LABELS: Record<RecordKind, { plural: string; singular: string }> = {
  people: { plural: "People", singular: "Person" },
  companies: { plural: "Companies", singular: "Company" },
  opportunities: { plural: "Opportunities", singular: "Opportunity" },
  sites: { plural: "Sites", singular: "Site" },
};

export const listHref = (kind: RecordKind): string => `${RECORD_APPS[appOf(kind)].base}/${kind}`;

export const recordHref = (kind: RecordKind, id: string): string => `${listHref(kind)}/${id}`;

export const roomHref = (id: string): string => `/portal/data-rooms/${id}`;

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

export interface SiteGroup {
  id: string;
  name: string;
  position: number;
}

export interface SiteStatus {
  id: string;
  name: string;
  position: number;
  color: string;
}

export interface SiteRow {
  id: string;
  name: string;
  address: string | null;
  group_id: string | null;
  status_id: string;
  provider_name: string | null;
  customer_name: string | null;
  deal_type: string | null;
  initial_it_mw: number | null;
  secondary_it_mw: number | null;
  total_it_mw: number;
  upfront: number | null;
  conversion: number | null;
  contract_value: number | null;
  annual_revenue: number | null;
  /** `YYYY-MM-DD`. */
  rfs_date: string | null;
  active: boolean;
}

/** A data room a site can link to. */
export interface SiteRoom {
  id: string;
  name: string;
}

export interface ZrmData {
  people: PersonRow[];
  companies: CompanyRow[];
  opportunities: OpportunityRow[];
  types: ZrmType[];
  stages: Stage[];
  sites: SiteRow[];
  groups: SiteGroup[];
  statuses: SiteStatus[];
  rooms: SiteRoom[];
}

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

export interface Site {
  id: string;
  name: string;
  address: string | null;
  group_id: string | null;
  group_name: string | null;
  status_id: string;
  status_name: string;
  status_color: string;
  provider_company_id: string | null;
  provider_name: string | null;
  term_years: number | null;
  deal_type: string | null;
  initial_it_mw: number | null;
  secondary_it_mw: number | null;
  total_it_mw: number;
  kw_rate: number | null;
  power_rate: number | null;
  upfront: number | null;
  conversion: number | null;
  /** `YYYY-MM-DD`. */
  rfs_date: string | null;
  cooling: string | null;
  vdr_url: string | null;
  link_url: string | null;
  data_room_id: string | null;
  data_room_name: string | null;
  customer_company_id: string | null;
  customer_name: string | null;
  broker_person_id: string | null;
  broker_name: string | null;
  firm_company_id: string | null;
  firm_name: string | null;
  contract_value: number | null;
  annual_revenue: number | null;
  notes: string | null;
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

const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });

export const formatDecimal = (value: number | null): string => (value == null ? "" : decimal.format(value));

const megawatts = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatMw = (value: number | null): string => (value == null ? "" : `${megawatts.format(value)} MW`);
