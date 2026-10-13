import "server-only";
import { db } from "@/lib/db";
import { isUuid } from "./access";
import type {
  Activity,
  Company,
  CompanyRow,
  CustomField,
  Education,
  Note,
  Opportunity,
  OpportunityRow,
  Person,
  PersonRow,
  Related,
  Stage,
  WorkExperience,
  ZrmData,
  ZrmType,
} from "./types";

/*
 * Neon hands back `date` columns as Dates at local midnight and `numeric` as
 * strings, so dates are read as `::text` (YYYY-MM-DD) and money as `::float8`.
 * Type ids are cast to `text[]`, which it parses into an array.
 *
 * Each loader sends its queries as one read-only transaction: one HTTP round
 * trip to Neon, rather than one per query.
 */

type Sql = ReturnType<typeof db>;

const peopleQuery = (sql: Sql) => sql`
  select p.id, p.first_name, p.last_name, p.title, p.email, p.company_id, c.name as company_name, p.active,
    coalesce((select array_agg(ct.type_id)::text[] from zrm_company_types ct where ct.company_id = p.company_id), '{}') as type_ids
  from zrm_people p
  left join zrm_companies c on c.id = p.company_id
  order by lower(coalesce(p.first_name, '')), lower(coalesce(p.last_name, ''))
`;

const companiesQuery = (sql: Sql) => sql`
  select c.id, c.name, c.industry, c.domain, c.employee_count, c.country, c.active,
    coalesce((select array_agg(ct.type_id)::text[] from zrm_company_types ct where ct.company_id = c.id), '{}') as type_ids
  from zrm_companies c
  order by lower(c.name)
`;

const opportunitiesQuery = (sql: Sql) => sql`
  select o.id, o.title, o.person_id,
    nullif(concat_ws(' ', p.first_name, p.last_name), '') as person_name,
    o.company_id, c.name as company_name,
    o.stage_id, s.name as stage_name, s.position as stage_position,
    o.value::float8 as value, o.active,
    coalesce((select array_agg(ct.type_id)::text[] from zrm_company_types ct where ct.company_id = o.company_id), '{}') as type_ids
  from zrm_opportunities o
  join zrm_stages s on s.id = o.stage_id
  left join zrm_people p on p.id = o.person_id
  left join zrm_companies c on c.id = o.company_id
  order by o.updated_at desc
`;

const typesQuery = (sql: Sql) => sql`select id, name, color from zrm_types order by lower(name)`;

const stagesQuery = (sql: Sql) => sql`select id, name, position from zrm_stages order by position, name`;

/** Everything the three tabs list, loaded once by the ZRM layout so switching tabs doesn't touch the database. */
export async function loadZrmData(): Promise<ZrmData> {
  const sql = db();
  const [people, companies, opportunities, types, stages] = await sql.transaction(
    [peopleQuery(sql), companiesQuery(sql), opportunitiesQuery(sql), typesQuery(sql), stagesQuery(sql)],
    { readOnly: true },
  );
  return {
    people: people as PersonRow[],
    companies: companies as CompanyRow[],
    opportunities: opportunities as OpportunityRow[],
    types: types as ZrmType[],
    stages: stages as Stage[],
  };
}

const typesOfCompany = (sql: Sql, companyId: string) => sql`
  select t.id, t.name, t.color
  from zrm_company_types ct join zrm_types t on t.id = ct.type_id
  where ct.company_id = ${companyId}
  order by lower(t.name)
`;

/** The types of the company a person or opportunity belongs to. */
const typesThrough = (sql: Sql, table: "zrm_people" | "zrm_opportunities", id: string) =>
  sql.query(
    `select t.id, t.name, t.color
     from ${table} r
     join zrm_company_types ct on ct.company_id = r.company_id
     join zrm_types t on t.id = ct.type_id
     where r.id = $1
     order by lower(t.name)`,
    [id],
  );

const notesOf = (sql: Sql, column: "person_id" | "company_id" | "opportunity_id", id: string) =>
  sql.query(`select id, body, author_email, created_at from zrm_notes where ${column} = $1 order by created_at desc`, [id]);

const customFieldsOf = (sql: Sql, column: "person_id" | "company_id", id: string) =>
  sql.query(`select id, key, value from zrm_custom_fields where ${column} = $1 order by position`, [id]);

/** A person's or company's opportunities, with their stage and value as the detail. */
const opportunitiesOf = (sql: Sql, column: "person_id" | "company_id", id: string) =>
  sql.query(
    `select o.id, o.title as label, concat_ws(' · ', s.name, to_char(o.value, 'FM$999,999,999,990')) as detail
     from zrm_opportunities o join zrm_stages s on s.id = o.stage_id
     where o.${column} = $1 order by o.updated_at desc`,
    [id],
  );

export interface PersonDetail {
  person: Person;
  types: ZrmType[];
  work: WorkExperience[];
  education: Education[];
  custom: CustomField[];
  opportunities: Related[];
  notes: Note[];
}

export async function getPersonDetail(id: string): Promise<PersonDetail | null> {
  if (!isUuid(id)) return null;
  const sql = db();
  const [[person], types, work, education, custom, opportunities, notes] = await sql.transaction(
    [
      sql`
        select p.id, p.first_name, p.last_name, p.title, p.seniority, p.department, p.email, p.personal_email,
          p.email_status, p.phone, p.mobile_phone, p.linkedin_url, p.twitter_url, p.github_url, p.company_id,
          c.name as company_name, p.location, p.city, p.state, p.country, p.headline, p.bio, p.photo_url,
          p.job_started_at::text as job_started_at, p.skills, p.tags, p.active, p.source, p.created_at, p.updated_at
        from zrm_people p
        left join zrm_companies c on c.id = p.company_id
        where p.id = ${id}
      `,
      typesThrough(sql, "zrm_people", id),
      sql`
        select id, company, title, start_date::text as start_date, end_date::text as end_date
        from zrm_work_history where person_id = ${id}
        order by position, start_date desc nulls last
      `,
      sql`
        select id, school, degree, field, start_date::text as start_date, end_date::text as end_date
        from zrm_education where person_id = ${id}
        order by position, start_date desc nulls last
      `,
      customFieldsOf(sql, "person_id", id),
      opportunitiesOf(sql, "person_id", id),
      notesOf(sql, "person_id", id),
    ],
    { readOnly: true },
  );
  if (!person) return null;
  return {
    person: person as Person,
    types: types as ZrmType[],
    work: work as WorkExperience[],
    education: education as Education[],
    custom: custom as CustomField[],
    opportunities: opportunities as Related[],
    notes: notes as Note[],
  };
}

export interface CompanyDetail {
  company: Company;
  types: ZrmType[];
  custom: CustomField[];
  people: Related[];
  opportunities: Related[];
  notes: Note[];
}

export async function getCompanyDetail(id: string): Promise<CompanyDetail | null> {
  if (!isUuid(id)) return null;
  const sql = db();
  const [[company], types, custom, people, opportunities, notes] = await sql.transaction(
    [
      sql`select * from zrm_companies where id = ${id}`,
      typesOfCompany(sql, id),
      customFieldsOf(sql, "company_id", id),
      sql`
        select id, coalesce(nullif(concat_ws(' ', first_name, last_name), ''), 'Unnamed') as label, title as detail
        from zrm_people where company_id = ${id}
        order by lower(coalesce(first_name, '')), lower(coalesce(last_name, ''))
      `,
      opportunitiesOf(sql, "company_id", id),
      notesOf(sql, "company_id", id),
    ],
    { readOnly: true },
  );
  if (!company) return null;
  return {
    company: company as Company,
    types: types as ZrmType[],
    custom: custom as CustomField[],
    people: people as Related[],
    opportunities: opportunities as Related[],
    notes: notes as Note[],
  };
}

export interface OpportunityDetail {
  opportunity: Opportunity;
  types: ZrmType[];
  activities: Activity[];
  notes: Note[];
}

export async function getOpportunityDetail(id: string): Promise<OpportunityDetail | null> {
  if (!isUuid(id)) return null;
  const sql = db();
  const [[opportunity], types, activities, notes] = await sql.transaction(
    [
      sql`
        select o.id, o.title, o.person_id,
          nullif(concat_ws(' ', p.first_name, p.last_name), '') as person_name,
          o.company_id, c.name as company_name, o.stage_id, s.name as stage_name,
          o.value::float8 as value, o.owner_notes, o.active, o.created_at, o.updated_at
        from zrm_opportunities o
        join zrm_stages s on s.id = o.stage_id
        left join zrm_people p on p.id = o.person_id
        left join zrm_companies c on c.id = o.company_id
        where o.id = ${id}
      `,
      typesThrough(sql, "zrm_opportunities", id),
      sql`select id, kind, note, at from zrm_activities where opportunity_id = ${id} order by at desc`,
      notesOf(sql, "opportunity_id", id),
    ],
    { readOnly: true },
  );
  if (!opportunity) return null;
  return {
    opportunity: opportunity as Opportunity,
    types: types as ZrmType[],
    activities: activities as Activity[],
    notes: notes as Note[],
  };
}
