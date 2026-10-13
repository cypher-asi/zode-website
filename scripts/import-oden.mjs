/**
 * Imports OD3N's People, Companies and Opportunities into ZRM's tables in
 * DATABASE_URL, from an OD3N seed bundle (`zrm-seed-export` in the oden repo
 * writes one to deploy/seed/zrm-seed.json from its local RocksDB).
 *
 *   npm run zrm:import -- [path/to/zrm-seed.json]
 *
 * Additive, like OD3N's own seed sync: records are matched on `legacy_id`
 * (their OD3N id), missing ones are inserted with their work history,
 * education, custom fields, types and activities, and existing ones are left
 * alone, so edits made in ZRM survive a re-run. Each table goes in as one
 * statement over a JSON array, since the HTTP driver is one round trip a query.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[zrm:import] DATABASE_URL is not set; add it to .env.local.");
  process.exit(1);
}

const bundlePath = process.argv[2] ?? fileURLToPath(new URL("../../zrm/deploy/seed/zrm-seed.json", import.meta.url));
const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
if (bundle.version !== 1 || typeof bundle.cfs !== "object") {
  console.error(`[zrm:import] ${bundlePath} isn't an OD3N seed bundle (version 1).`);
  process.exit(1);
}

const records = (cf) => Object.values(bundle.cfs[cf] ?? {});
const sql = neon(url);

// Cleaning

const str = (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
};
const href = (value) => {
  const text = str(value);
  return text && !/^https?:\/\//i.test(text) ? `https://${text}` : text;
};
const ts = (value) => str(value) ?? new Date().toISOString();
const int = (value) => (typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null);
const date = (value) => {
  const text = str(value);
  if (!text) return null;
  const full = /^\d{4}-\d{2}-\d{2}/.exec(text)?.[0];
  if (full) return full;
  if (/^\d{4}-\d{2}$/.test(text)) return `${text}-01`;
  if (/^\d{4}$/.test(text)) return `${text}-01-01`;
  return null;
};
const list = (value) => (Array.isArray(value) ? [...new Set(value.map(str).filter(Boolean))] : []);
const STAGE_ALIASES = { MeetingScheduled: "Meeting Scheduled", ProposalSent: "Proposal Sent", SignedContract: "Signed Contract" };

/**
 * `insert into table (cols) select cols from jsonb_to_recordset($1)`, with
 * `conflict` deciding what happens to rows already there. Returns the rows
 * `returning` asks for, i.e. those actually inserted.
 */
async function insertSet(table, columns, rows, { conflict = "on conflict do nothing", returning = "" } = {}) {
  if (rows.length === 0) return [];
  const names = Object.keys(columns);
  const quoted = names.map((name) => `"${name}"`).join(", ");
  const shape = names.map((name) => `"${name}" ${columns[name]}`).join(", ");
  return sql.query(
    `insert into ${table} (${quoted})
     select ${quoted} from jsonb_to_recordset($1::jsonb) as x (${shape})
     ${conflict} ${returning}`,
    [JSON.stringify(rows)],
  );
}

async function idMap(table, key = "legacy_id") {
  const rows = await sql.query(`select id, ${key} as key from ${table} where ${key} is not null`);
  return new Map(rows.map((row) => [row.key, row.id]));
}

const counts = {};
const count = (label, rows) => {
  counts[label] = (counts[label] ?? 0) + rows.length;
};

// Types: company categories, matched by name too so a type made in ZRM isn't doubled.

count(
  "types",
  await insertSet(
    "zrm_types",
    { legacy_id: "text", name: "text", color: "text", created_at: "timestamptz", updated_at: "timestamptz" },
    records("record_type")
      .filter((t) => str(t.name))
      .map((t) => ({
        legacy_id: t.id,
        name: str(t.name),
        color: str(t.color) ?? "#94A3B8",
        created_at: ts(t.created_at),
        updated_at: ts(t.updated_at),
      })),
    { returning: "returning id" },
  ),
);

// Stages: the opportunities board's lanes, plus any stage an opportunity names that the board lacks.

const stageName = (name) => STAGE_ALIASES[name] ?? str(name);
const lanes = records("kanban_board").find((board) => board.app === "opportunities")?.lanes ?? [];
const laneNames = [...lanes].sort((a, b) => a.order - b.order).map((lane) => stageName(lane.name));
const extraStages = records("opportunity")
  .map((o) => stageName(o.stage))
  .filter((name) => name && !laneNames.includes(name));
const [{ max }] = await sql`select coalesce(max(position), -1) as max from zrm_stages`;
count(
  "stages",
  await insertSet(
    "zrm_stages",
    { name: "text", position: "integer" },
    [...new Set([...laneNames, ...extraStages])].filter(Boolean).map((name, i) => ({ name, position: max + 1 + i })),
    { conflict: "on conflict (name) do nothing", returning: "returning id" },
  ),
);

// Companies, then the companies people name without linking to one.

const COMPANY_COLUMNS = {
  legacy_id: "text",
  name: "text",
  legal_name: "text",
  domain: "text",
  website: "text",
  industry: "text",
  employee_count: "integer",
  revenue: "text",
  founded_year: "integer",
  company_type: "text",
  description: "text",
  logo_url: "text",
  email: "text",
  phone: "text",
  linkedin_url: "text",
  twitter_url: "text",
  crunchbase_url: "text",
  location: "text",
  city: "text",
  state: "text",
  country: "text",
  funding_stage: "text",
  total_funding: "text",
  latest_round: "text",
  latest_valuation: "text",
  ticker: "text",
  market_cap: "text",
  technologies: "text[]",
  specialties: "text[]",
  tags: "text[]",
  active: "boolean",
  source: "text",
  created_at: "timestamptz",
  updated_at: "timestamptz",
};

const companies = records("company").filter((c) => str(c.name));
const newCompanies = await insertSet(
  "zrm_companies",
  COMPANY_COLUMNS,
  companies.map((c) => ({
    legacy_id: c.id,
    name: str(c.name),
    legal_name: str(c.legal_name),
    domain: str(c.domain),
    website: href(c.website),
    industry: str(c.industry),
    employee_count: int(c.employee_count),
    revenue: str(c.revenue),
    founded_year: int(c.founded_year),
    company_type: str(c.company_type),
    description: str(c.description),
    logo_url: href(c.logo_url),
    email: str(c.email),
    phone: str(c.phone),
    linkedin_url: href(c.linkedin_url),
    twitter_url: href(c.twitter_url),
    crunchbase_url: href(c.crunchbase_url),
    location: str(c.location),
    city: str(c.city),
    state: str(c.state),
    country: str(c.country),
    funding_stage: str(c.funding_stage),
    total_funding: str(c.total_funding),
    latest_round: str(c.latest_round),
    latest_valuation: str(c.latest_valuation),
    ticker: str(c.ticker),
    market_cap: str(c.market_cap),
    technologies: list(c.technologies),
    specialties: list(c.specialties),
    tags: list(c.tags),
    active: c.active === true,
    source: str(c.source),
    created_at: ts(c.created_at),
    updated_at: ts(c.updated_at),
  })),
  { conflict: "on conflict (legacy_id) do nothing", returning: "returning legacy_id" },
);
count("companies", newCompanies);
const isNewCompany = new Set(newCompanies.map((row) => row.legacy_id));
let companyIds = await idMap("zrm_companies");

const people = records("person");
const companyByName = new Map(
  (await sql`select id, lower(name) as name from zrm_companies`).map((row) => [row.name, row.id]),
);
const unlinkedNames = [
  ...new Set(
    people
      .filter((p) => !(p.company_id && companyIds.has(p.company_id)) && str(p.company_name))
      .map((p) => str(p.company_name))
      .filter((name) => !companyByName.has(name.toLowerCase())),
  ),
];
const namedCompanies = await insertSet(
  "zrm_companies",
  { name: "text", source: "text" },
  unlinkedNames.map((name) => ({ name, source: "od3n_import" })),
  { conflict: "", returning: "returning id, lower(name) as name" },
);
count("companies", namedCompanies);
for (const row of namedCompanies) companyByName.set(row.name, row.id);

const companyFor = (legacyId, name) =>
  (legacyId && companyIds.get(legacyId)) || (str(name) && companyByName.get(str(name).toLowerCase())) || null;

// Company types and custom fields, for companies new in this run.

const typeIds = await idMap("zrm_types", "name");
count(
  "company types",
  await insertSet(
    "zrm_company_types",
    { company_id: "uuid", type_id: "uuid" },
    companies
      .filter((c) => isNewCompany.has(c.id))
      .flatMap((c) =>
        list(c.type)
          .filter((name) => typeIds.has(name))
          .map((name) => ({ company_id: companyIds.get(c.id), type_id: typeIds.get(name) })),
      ),
    { returning: "returning type_id" },
  ),
);

const customRows = (items, column, id) =>
  (Array.isArray(items) ? items : [])
    .filter((field) => str(field?.key))
    .map((field, position) => ({ [column]: id, position, key: str(field.key), value: str(field.value) ?? "" }));

count(
  "custom fields",
  await insertSet(
    "zrm_custom_fields",
    { company_id: "uuid", position: "integer", key: "text", value: "text" },
    companies.filter((c) => isNewCompany.has(c.id)).flatMap((c) => customRows(c.custom, "company_id", companyIds.get(c.id))),
    { conflict: "", returning: "returning id" },
  ),
);

// People, with their work history, education and custom fields.

const newPeople = await insertSet(
  "zrm_people",
  {
    legacy_id: "text",
    first_name: "text",
    last_name: "text",
    title: "text",
    seniority: "text",
    department: "text",
    email: "text",
    personal_email: "text",
    email_status: "text",
    phone: "text",
    mobile_phone: "text",
    linkedin_url: "text",
    twitter_url: "text",
    github_url: "text",
    company_id: "uuid",
    location: "text",
    city: "text",
    state: "text",
    country: "text",
    headline: "text",
    bio: "text",
    photo_url: "text",
    job_started_at: "date",
    skills: "text[]",
    tags: "text[]",
    active: "boolean",
    source: "text",
    created_at: "timestamptz",
    updated_at: "timestamptz",
  },
  people.map((p) => ({
    legacy_id: p.id,
    first_name: str(p.first_name),
    last_name: str(p.last_name),
    title: str(p.title),
    seniority: str(p.seniority),
    department: str(p.department),
    email: str(p.email),
    personal_email: str(p.personal_email),
    email_status: str(p.email_status),
    phone: str(p.phone),
    mobile_phone: str(p.mobile_phone),
    linkedin_url: href(p.linkedin_url),
    twitter_url: href(p.twitter_url),
    github_url: href(p.github_url),
    company_id: companyFor(p.company_id, p.company_name),
    location: str(p.location),
    city: str(p.city),
    state: str(p.state),
    country: str(p.country),
    headline: str(p.headline),
    bio: str(p.bio),
    photo_url: href(p.photo_url),
    job_started_at: date(p.job_started_at),
    skills: list(p.skills),
    tags: list(p.tags),
    active: p.active === true,
    source: str(p.source),
    created_at: ts(p.created_at),
    updated_at: ts(p.updated_at),
  })),
  { conflict: "on conflict (legacy_id) do nothing", returning: "returning legacy_id" },
);
count("people", newPeople);
const isNewPerson = new Set(newPeople.map((row) => row.legacy_id));
const personIds = await idMap("zrm_people");
const addedPeople = people.filter((p) => isNewPerson.has(p.id));

count(
  "work history",
  await insertSet(
    "zrm_work_history",
    { person_id: "uuid", position: "integer", company: "text", title: "text", start_date: "date", end_date: "date" },
    addedPeople.flatMap((p) =>
      (p.work_history ?? []).map((w, position) => ({
        person_id: personIds.get(p.id),
        position,
        company: str(w.company),
        title: str(w.title),
        start_date: date(w.start),
        end_date: date(w.end),
      })),
    ),
    { conflict: "", returning: "returning id" },
  ),
);

count(
  "education",
  await insertSet(
    "zrm_education",
    { person_id: "uuid", position: "integer", school: "text", degree: "text", field: "text", start_date: "date", end_date: "date" },
    addedPeople.flatMap((p) =>
      (p.education ?? []).map((e, position) => ({
        person_id: personIds.get(p.id),
        position,
        school: str(e.school),
        degree: str(e.degree),
        field: str(e.field),
        start_date: date(e.start),
        end_date: date(e.end),
      })),
    ),
    { conflict: "", returning: "returning id" },
  ),
);

count(
  "custom fields",
  await insertSet(
    "zrm_custom_fields",
    { person_id: "uuid", position: "integer", key: "text", value: "text" },
    addedPeople.flatMap((p) => customRows(p.custom, "person_id", personIds.get(p.id))),
    { conflict: "", returning: "returning id" },
  ),
);

// Opportunities and their activities.

companyIds = await idMap("zrm_companies");
const stageIds = await idMap("zrm_stages", "name");
const firstStage = (await sql`select id from zrm_stages order by position limit 1`)[0]?.id;
const opportunities = records("opportunity").filter((o) => str(o.title));

const newOpportunities = await insertSet(
  "zrm_opportunities",
  {
    legacy_id: "text",
    title: "text",
    person_id: "uuid",
    company_id: "uuid",
    stage_id: "uuid",
    value: "numeric",
    owner_notes: "text",
    active: "boolean",
    created_at: "timestamptz",
    updated_at: "timestamptz",
  },
  opportunities.map((o) => ({
    legacy_id: o.id,
    title: str(o.title),
    person_id: personIds.get(o.person_id) ?? null,
    company_id: (o.company_id && companyIds.get(o.company_id)) || null,
    stage_id: stageIds.get(stageName(o.stage)) ?? firstStage,
    value: typeof o.value === "number" && Number.isFinite(o.value) ? o.value : null,
    owner_notes: str(o.owner_notes),
    active: o.active === true,
    created_at: ts(o.created_at),
    updated_at: ts(o.updated_at),
  })),
  { conflict: "on conflict (legacy_id) do nothing", returning: "returning legacy_id" },
);
count("opportunities", newOpportunities);
const opportunityIds = await idMap("zrm_opportunities");

count(
  "activities",
  await insertSet(
    "zrm_activities",
    { legacy_id: "text", opportunity_id: "uuid", kind: "text", note: "text", at: "timestamptz" },
    opportunities.flatMap((o) =>
      (o.activities ?? []).map((a) => ({
        legacy_id: a.id,
        opportunity_id: opportunityIds.get(o.id),
        kind: str(a.kind) ?? "Note",
        note: str(a.note) ?? "",
        at: a.at ?? o.created_at,
      })),
    ),
    { conflict: "on conflict (legacy_id) do nothing", returning: "returning id" },
  ),
);

// Notes, on whichever record they were left on.

const NOTE_PARENTS = {
  persons: ["person_id", personIds],
  companies: ["company_id", companyIds],
  opportunities: ["opportunity_id", opportunityIds],
};
count(
  "notes",
  await insertSet(
    "zrm_notes",
    {
      legacy_id: "text",
      person_id: "uuid",
      company_id: "uuid",
      opportunity_id: "uuid",
      body: "text",
      created_at: "timestamptz",
      updated_at: "timestamptz",
    },
    records("note")
      .map((n) => {
        const [column, ids] = NOTE_PARENTS[n.entity_kind] ?? [];
        const parent = ids?.get(n.entity_id);
        return parent && str(n.body)
          ? { legacy_id: n.id, [column]: parent, body: str(n.body), created_at: ts(n.created_at), updated_at: ts(n.updated_at) }
          : null;
      })
      .filter(Boolean),
    { conflict: "on conflict (legacy_id) do nothing", returning: "returning id" },
  ),
);

const summary = Object.entries(counts)
  .map(([label, n]) => `${n} ${label}`)
  .join(", ");
console.log(`[zrm:import] added ${summary} to ${new URL(url).hostname} from ${bundlePath}`);
