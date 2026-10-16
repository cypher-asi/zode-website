import type { RecordKind } from "./types";

/**
 * How a field is edited and shown. References (`company`, `person`, `stage`,
 * `status`, `room`) hold an id, with its name alongside in the record under
 * `display`. `decimal`, unlike `money`, takes fractions and negatives.
 */
export type FieldType =
  | "text"
  | "textarea"
  | "email"
  | "url"
  | "tel"
  | "int"
  | "decimal"
  | "money"
  | "date"
  | "list"
  | "choice"
  | "company"
  | "person"
  | "stage"
  | "status"
  | "room";

export interface FieldSpec {
  /** The column, and the record property and form input of the same name. */
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** For references, the record property holding the referenced name. */
  display?: string;
  /** For `choice`, the values it can take. */
  options?: readonly string[];
  /** Shown but never edited, e.g. a generated column. */
  readOnly?: boolean;
  /** For free text, the names it suggests as it's typed. */
  suggest?: "companies";
  /** Only shown and saved while another of the record's fields holds one of these values, and cleared as it stops holding one. */
  onlyWhen?: Condition;
}

export interface Condition {
  key: string;
  values: readonly string[];
}

export const holds = (condition: Condition, value: unknown): boolean =>
  typeof value === "string" && condition.values.includes(value);

/** Whether `field` applies to `record`, i.e. has no condition or meets it. */
export const applies = (field: FieldSpec, record: object): boolean =>
  !field.onlyWhen || holds(field.onlyWhen, (record as Record<string, unknown>)[field.onlyWhen.key]);

export interface SectionSpec {
  id: string;
  title: string;
  fields: readonly FieldSpec[];
}

const text = (key: string, label: string, required?: boolean): FieldSpec => ({ key, label, type: "text", required });
const of = (type: FieldType) => (key: string, label: string): FieldSpec => ({ key, label, type });
const url = of("url");
const email = of("email");
const tel = of("tel");
const list = of("list");
const decimal = of("decimal");
const money = of("money");
const company: FieldSpec = { key: "company_id", label: "Company", type: "company", display: "company_name" };

export const DEAL_TYPES = ["Lease", "Purchase", "JV"] as const;

export type DealType = (typeof DEAL_TYPES)[number];

/**
 * The deal types a site's terms apply to: a lease pays rent over a term, a
 * purchase converts the building it buys, a JV does both, and any deal can
 * pay upfront. A site with no deal type has no terms. The database checks the
 * same (`capacity_sites_deal_terms_check`).
 */
const dealTerm = (field: FieldSpec, values: readonly DealType[]): FieldSpec => ({
  ...field,
  onlyWhen: { key: "deal_type", values },
});

/** What an opportunity sells or secures, compute first as the main kind. The database checks the same (`zrm_opportunities_deal_type_check`). */
export const OPPORTUNITY_DEAL_TYPES = ["Compute", "Capacity", "Hardware", "Financing", "Partnership"] as const;

export type OpportunityDealType = (typeof OPPORTUNITY_DEAL_TYPES)[number];

/** A site's type, by how built out it is, furthest first. Stored as `site_stage`. */
export const SITE_TYPES = ["Operational DC", "Retrofit", "Powered Shell", "Powered Land", "Land"] as const;

const site = {
  name: text("name", "Site", true),
  address: text("address", "Address"),
  status: { key: "status_id", label: "Status", type: "status", required: true, display: "status_name" },
  type: { key: "site_stage", label: "Type", type: "choice", options: SITE_TYPES },
  provider: { key: "provider_company_id", label: "Provider", type: "company", display: "provider_name" },
  dealType: { key: "deal_type", label: "Deal type", type: "choice", options: DEAL_TYPES },
  initial: decimal("initial_it_mw", "Initial IT (MW)"),
  secondary: decimal("secondary_it_mw", "Secondary IT (MW)"),
} satisfies Record<string, FieldSpec>;

export const TABLES: Record<RecordKind, string> = {
  people: "zrm_people",
  companies: "zrm_companies",
  opportunities: "zrm_opportunities",
  sites: "capacity_sites",
};

export const SECTIONS: Record<RecordKind, readonly SectionSpec[]> = {
  people: [
    {
      id: "basics",
      title: "Basics",
      fields: [text("first_name", "First name", true), text("last_name", "Last name"), text("title", "Title"), company, text("headline", "Headline")],
    },
    {
      id: "contact",
      title: "Contact",
      fields: [
        email("email", "Email"),
        text("email_status", "Email status"),
        email("personal_email", "Personal email"),
        tel("phone", "Phone"),
        tel("mobile_phone", "Mobile"),
        text("location", "Location"),
        text("city", "City"),
        text("state", "State"),
        text("country", "Country"),
      ],
    },
    {
      id: "role",
      title: "Role",
      fields: [text("seniority", "Seniority"), text("department", "Department"), { key: "job_started_at", label: "In role since", type: "date" }],
    },
    { id: "about", title: "About", fields: [{ key: "bio", label: "Bio", type: "textarea" }, text("source", "Source")] },
    {
      id: "online",
      title: "Online",
      fields: [url("linkedin_url", "LinkedIn"), url("twitter_url", "X / Twitter"), url("github_url", "GitHub"), url("photo_url", "Photo")],
    },
    { id: "skills", title: "Skills and tags", fields: [list("skills", "Skills"), list("tags", "Tags")] },
  ],
  companies: [
    {
      id: "basics",
      title: "Basics",
      fields: [text("name", "Name", true), text("legal_name", "Legal name"), text("industry", "Industry"), text("company_type", "Company type")],
    },
    { id: "about", title: "About", fields: [{ key: "description", label: "Description", type: "textarea" }, text("source", "Source")] },
    {
      id: "firmographics",
      title: "Firmographics",
      fields: [
        { key: "employee_count", label: "Employees", type: "int" },
        text("revenue", "Revenue"),
        { key: "founded_year", label: "Founded", type: "int" },
        text("location", "Location"),
        text("city", "City"),
        text("state", "State"),
        text("country", "Country"),
      ],
    },
    {
      id: "funding",
      title: "Funding",
      fields: [
        text("funding_stage", "Stage"),
        text("total_funding", "Total funding"),
        text("latest_round", "Latest round"),
        text("latest_valuation", "Latest valuation"),
        text("ticker", "Ticker"),
        text("market_cap", "Market cap"),
      ],
    },
    {
      id: "online",
      title: "Online",
      fields: [
        url("website", "Website"),
        text("domain", "Domain"),
        email("email", "Email"),
        tel("phone", "Phone"),
        url("linkedin_url", "LinkedIn"),
        url("twitter_url", "X / Twitter"),
        url("crunchbase_url", "Crunchbase"),
        url("logo_url", "Logo"),
      ],
    },
    {
      id: "stack",
      title: "Technologies and specialties",
      fields: [list("technologies", "Technologies"), list("specialties", "Specialties"), list("tags", "Tags")],
    },
  ],
  opportunities: [
    {
      id: "details",
      title: "Details",
      fields: [
        text("title", "Title", true),
        { key: "deal_type", label: "Deal type", type: "choice", required: true, options: OPPORTUNITY_DEAL_TYPES },
        { key: "stage_id", label: "Stage", type: "stage", required: true, display: "stage_name" },
        { key: "value", label: "Value (USD)", type: "money" },
        { key: "person_id", label: "Person", type: "person", display: "person_name" },
        company,
        { key: "owner_notes", label: "Owner notes", type: "textarea" },
      ],
    },
  ],
  sites: [
    {
      id: "site",
      title: "Site",
      fields: [
        site.name,
        site.address,
        site.status,
        site.type,
        site.provider,
        site.dealType,
        { key: "rfs_date", label: "RFS", type: "date" },
        text("cooling", "Cooling"),
      ],
    },
    {
      id: "capacity",
      title: "Capacity",
      fields: [site.initial, site.secondary, { key: "total_it_mw", label: "Total IT (MW)", type: "decimal", readOnly: true }],
    },
    {
      id: "economics",
      title: "Economics",
      fields: [
        dealTerm({ key: "term_years", label: "Term (years)", type: "int" }, ["Lease", "JV"]),
        dealTerm(money("kw_rate", "kW rate ($)"), ["Lease", "JV"]),
        decimal("power_rate", "Power ($/kWh)"),
        dealTerm(money("upfront", "Upfront ($)"), DEAL_TYPES),
        dealTerm(money("conversion", "Conversion ($)"), ["Purchase", "JV"]),
      ],
    },
    {
      id: "deal",
      title: "Deal",
      fields: [
        { key: "customer_company_id", label: "Customer", type: "company", display: "customer_name" },
        { key: "broker_person_id", label: "Broker", type: "person", display: "broker_name" },
        { key: "firm_company_id", label: "Firm", type: "company", display: "firm_name" },
        money("contract_value", "Contract ($)"),
        money("annual_revenue", "Annual revenue ($)"),
      ],
    },
    {
      id: "links",
      title: "Links and notes",
      fields: [
        { key: "data_room_id", label: "Data room", type: "room", display: "data_room_name" },
        url("vdr_url", "VDR"),
        url("link_url", "Link"),
        { key: "notes", label: "Site notes", type: "textarea" },
      ],
    },
  ],
};

/** What the New form asks for; the rest is filled in on the record. */
export const CREATE_FIELDS: Record<RecordKind, readonly FieldSpec[]> = {
  people: [text("first_name", "First name", true), text("last_name", "Last name"), text("title", "Title"), company, email("email", "Email")],
  companies: [text("name", "Name", true), text("domain", "Domain"), text("industry", "Industry"), url("website", "Website")],
  opportunities: SECTIONS.opportunities[0]!.fields.filter((field) => field.key !== "owner_notes"),
  sites: [site.name, site.address, site.status, site.type, site.provider, site.dealType, site.initial, site.secondary],
};

/** The site fields a list row's right-click menu sets directly. */
export const SITE_MENU_FIELDS = [site.status, site.type, site.dealType] as const;

/** A field of a kind's detail pane that can be edited in place, by its key. */
export const editableField = (kind: RecordKind, key: string): FieldSpec | undefined =>
  SECTIONS[kind].flatMap((section) => section.fields).find((field) => field.key === key && !field.readOnly);

/** The fields of a kind that stop applying once `key` is set to `value`, which that save clears. */
export const clearedBy = (kind: RecordKind, key: string, value: unknown): readonly FieldSpec[] =>
  SECTIONS[kind]
    .flatMap((section) => section.fields)
    .filter((field) => field.onlyWhen?.key === key && !holds(field.onlyWhen, value));

/** `clearedBy` as a row's columns, for showing a save in the lists while it's in flight. */
export const clearedColumns = (kind: RecordKind, key: string, value: unknown): Record<string, null> =>
  Object.fromEntries(clearedBy(kind, key, value).map((field) => [field.key, null]));

/** The fields a section's form saves, leaving out read-only ones. */
export const fieldsFor = (kind: RecordKind, section: string): readonly FieldSpec[] | undefined =>
  (section === "create" ? CREATE_FIELDS[kind] : SECTIONS[kind].find((s) => s.id === section)?.fields)?.filter(
    (field) => !field.readOnly,
  );

/** Rows listed under a record: its experience, schooling, custom fields, activities and notes. */
export type ChildKind = "work" | "education" | "custom" | "activity" | "note";

export interface ChildSpec {
  table: string;
  /** The parent column for each kind of record the child can hang off. */
  parents: Partial<Record<RecordKind, string>>;
  fields: readonly FieldSpec[];
  /** Appended in display order rather than by time. */
  ordered: boolean;
  /** Has an `updated_at` to stamp as a field is edited. */
  touch?: boolean;
}

export const CHILDREN: Record<ChildKind, ChildSpec> = {
  work: {
    table: "zrm_work_history",
    parents: { people: "person_id" },
    fields: [
      text("title", "Title"),
      { ...text("company", "Company", true), suggest: "companies" },
      { key: "start_date", label: "Start", type: "date" },
      { key: "end_date", label: "End", type: "date" },
    ],
    ordered: true,
  },
  education: {
    table: "zrm_education",
    parents: { people: "person_id" },
    fields: [
      text("school", "School", true),
      text("degree", "Degree"),
      text("field", "Field"),
      { key: "start_date", label: "Start", type: "date" },
      { key: "end_date", label: "End", type: "date" },
    ],
    ordered: true,
  },
  custom: {
    table: "zrm_custom_fields",
    parents: { people: "person_id", companies: "company_id" },
    fields: [text("key", "Field", true), { key: "value", label: "Value", type: "textarea" }],
    ordered: true,
  },
  activity: {
    table: "zrm_activities",
    parents: { opportunities: "opportunity_id" },
    fields: [text("kind", "Kind", true), { key: "at", label: "Date", type: "date" }, { key: "note", label: "Note", type: "textarea" }],
    ordered: false,
  },
  note: {
    table: "zrm_notes",
    parents: { people: "person_id", companies: "company_id", opportunities: "opportunity_id", sites: "site_id" },
    fields: [{ key: "body", label: "Note", type: "textarea", required: true }],
    ordered: false,
    touch: true,
  },
};

export const isChildKind = (value: unknown): value is ChildKind =>
  typeof value === "string" && Object.hasOwn(CHILDREN, value);
