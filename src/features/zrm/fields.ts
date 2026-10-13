import type { ZrmKind } from "./types";

/**
 * How a field is edited and shown. References (`company`, `person`, `stage`)
 * hold an id, with its name alongside in the record under `display`.
 */
export type FieldType =
  | "text"
  | "textarea"
  | "email"
  | "url"
  | "tel"
  | "int"
  | "money"
  | "date"
  | "list"
  | "company"
  | "person"
  | "stage";

export interface FieldSpec {
  /** The column, and the record property and form input of the same name. */
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** For references, the record property holding the referenced name. */
  display?: string;
}

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
const company: FieldSpec = { key: "company_id", label: "Company", type: "company", display: "company_name" };

export const TABLES: Record<ZrmKind, string> = {
  people: "zrm_people",
  companies: "zrm_companies",
  opportunities: "zrm_opportunities",
};

export const SECTIONS: Record<ZrmKind, readonly SectionSpec[]> = {
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
        { key: "stage_id", label: "Stage", type: "stage", required: true, display: "stage_name" },
        { key: "value", label: "Value (USD)", type: "money" },
        { key: "person_id", label: "Person", type: "person", display: "person_name" },
        company,
        { key: "owner_notes", label: "Owner notes", type: "textarea" },
      ],
    },
  ],
};

/** What the New form asks for; the rest is filled in on the record. */
export const CREATE_FIELDS: Record<ZrmKind, readonly FieldSpec[]> = {
  people: [text("first_name", "First name", true), text("last_name", "Last name"), text("title", "Title"), company, email("email", "Email")],
  companies: [text("name", "Name", true), text("domain", "Domain"), text("industry", "Industry"), url("website", "Website")],
  opportunities: SECTIONS.opportunities[0]!.fields.filter((field) => field.key !== "owner_notes"),
};

export const fieldsFor = (kind: ZrmKind, section: string): readonly FieldSpec[] | undefined =>
  section === "create" ? CREATE_FIELDS[kind] : SECTIONS[kind].find((s) => s.id === section)?.fields;

/** Rows listed under a record: its experience, schooling, custom fields, activities and notes. */
export type ChildKind = "work" | "education" | "custom" | "activity" | "note";

export interface ChildSpec {
  table: string;
  /** The parent column for each kind of record the child can hang off. */
  parents: Partial<Record<ZrmKind, string>>;
  fields: readonly FieldSpec[];
  /** Appended in display order rather than by time. */
  ordered: boolean;
}

export const CHILDREN: Record<ChildKind, ChildSpec> = {
  work: {
    table: "zrm_work_history",
    parents: { people: "person_id" },
    fields: [
      text("title", "Title"),
      text("company", "Company", true),
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
    parents: { people: "person_id", companies: "company_id", opportunities: "opportunity_id" },
    fields: [{ key: "body", label: "Note", type: "textarea", required: true }],
    ordered: false,
  },
};

export const isChildKind = (value: unknown): value is ChildKind =>
  typeof value === "string" && Object.hasOwn(CHILDREN, value);
