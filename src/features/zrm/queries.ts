import "server-only";
import { db } from "@/lib/db";
import { isUuid } from "./access";
import type {
  Activity,
  Company,
  CompanyRow,
  CustomField,
  Education,
  ListRows,
  Note,
  Opportunity,
  OpportunityRow,
  Option,
  Person,
  PersonRow,
  Related,
  Stage,
  WorkExperience,
  ZrmKind,
  ZrmType,
} from "./types";

/*
 * Neon hands back `date` columns as Dates at local midnight and `numeric` as
 * strings, so dates are read as `::text` (YYYY-MM-DD) and money as `::float8`.
 * Type ids are cast to `text[]`, which it parses into an array.
 */

const rows = <T>(result: unknown): T[] => result as T[];

export async function listPeople(): Promise<PersonRow[]> {
  return rows<PersonRow>(await db()`
    select p.id, p.first_name, p.last_name, p.title, p.email, p.company_id, c.name as company_name, p.active,
      coalesce((select array_agg(ct.type_id)::text[] from zrm_company_types ct where ct.company_id = p.company_id), '{}') as type_ids
    from zrm_people p
    left join zrm_companies c on c.id = p.company_id
    order by lower(coalesce(p.first_name, '')), lower(coalesce(p.last_name, ''))
  `);
}

export async function listCompanies(): Promise<CompanyRow[]> {
  return rows<CompanyRow>(await db()`
    select c.id, c.name, c.industry, c.domain, c.employee_count, c.country, c.active,
      coalesce((select array_agg(ct.type_id)::text[] from zrm_company_types ct where ct.company_id = c.id), '{}') as type_ids
    from zrm_companies c
    order by lower(c.name)
  `);
}

export async function listOpportunities(): Promise<OpportunityRow[]> {
  return rows<OpportunityRow>(await db()`
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
  `);
}

export async function listRows(kind: ZrmKind): Promise<ListRows> {
  switch (kind) {
    case "people":
      return { kind, rows: await listPeople() };
    case "companies":
      return { kind, rows: await listCompanies() };
    case "opportunities":
      return { kind, rows: await listOpportunities() };
  }
}

export async function listTypes(): Promise<ZrmType[]> {
  return rows<ZrmType>(await db()`select id, name, color from zrm_types order by lower(name)`);
}

export async function listStages(): Promise<Stage[]> {
  return rows<Stage>(await db()`select id, name, position from zrm_stages order by position, name`);
}

/** Pickers for the company and person fields. */
export async function referenceOptions(): Promise<{ companies: Option[]; people: Option[] }> {
  const sql = db();
  const [companies, people] = await Promise.all([
    sql`select id as value, name as label from zrm_companies order by lower(name)`,
    sql`
      select p.id as value,
        concat_ws(' · ', nullif(concat_ws(' ', p.first_name, p.last_name), ''), c.name) as label
      from zrm_people p left join zrm_companies c on c.id = p.company_id
      order by lower(coalesce(p.first_name, '')), lower(coalesce(p.last_name, ''))
    `,
  ]);
  return { companies: rows<Option>(companies), people: rows<Option>(people) };
}

export async function getPerson(id: string): Promise<Person | null> {
  if (!isUuid(id)) return null;
  const [row] = await db()`
    select p.id, p.first_name, p.last_name, p.title, p.seniority, p.department, p.email, p.personal_email,
      p.email_status, p.phone, p.mobile_phone, p.linkedin_url, p.twitter_url, p.github_url, p.company_id,
      c.name as company_name, p.location, p.city, p.state, p.country, p.headline, p.bio, p.photo_url,
      p.job_started_at::text as job_started_at, p.skills, p.tags, p.active, p.source, p.created_at, p.updated_at
    from zrm_people p
    left join zrm_companies c on c.id = p.company_id
    where p.id = ${id}
  `;
  return (row as Person | undefined) ?? null;
}

export async function getCompany(id: string): Promise<Company | null> {
  if (!isUuid(id)) return null;
  const [row] = await db()`select * from zrm_companies where id = ${id}`;
  return (row as Company | undefined) ?? null;
}

export async function getOpportunity(id: string): Promise<Opportunity | null> {
  if (!isUuid(id)) return null;
  const [row] = await db()`
    select o.id, o.title, o.person_id,
      nullif(concat_ws(' ', p.first_name, p.last_name), '') as person_name,
      o.company_id, c.name as company_name, o.stage_id, s.name as stage_name,
      o.value::float8 as value, o.owner_notes, o.active, o.created_at, o.updated_at
    from zrm_opportunities o
    join zrm_stages s on s.id = o.stage_id
    left join zrm_people p on p.id = o.person_id
    left join zrm_companies c on c.id = o.company_id
    where o.id = ${id}
  `;
  return (row as Opportunity | undefined) ?? null;
}

export async function companyTypes(companyId: string | null): Promise<ZrmType[]> {
  if (!companyId) return [];
  return rows<ZrmType>(await db()`
    select t.id, t.name, t.color
    from zrm_company_types ct join zrm_types t on t.id = ct.type_id
    where ct.company_id = ${companyId}
    order by lower(t.name)
  `);
}

export async function workHistory(personId: string): Promise<WorkExperience[]> {
  return rows<WorkExperience>(await db()`
    select id, company, title, start_date::text as start_date, end_date::text as end_date
    from zrm_work_history where person_id = ${personId}
    order by position, start_date desc nulls last
  `);
}

export async function education(personId: string): Promise<Education[]> {
  return rows<Education>(await db()`
    select id, school, degree, field, start_date::text as start_date, end_date::text as end_date
    from zrm_education where person_id = ${personId}
    order by position, start_date desc nulls last
  `);
}

export async function customFields(kind: "people" | "companies", id: string): Promise<CustomField[]> {
  const sql = db();
  const result =
    kind === "people"
      ? await sql`select id, key, value from zrm_custom_fields where person_id = ${id} order by position`
      : await sql`select id, key, value from zrm_custom_fields where company_id = ${id} order by position`;
  return rows<CustomField>(result);
}

export async function activities(opportunityId: string): Promise<Activity[]> {
  return rows<Activity>(await db()`
    select id, kind, note, at from zrm_activities where opportunity_id = ${opportunityId} order by at desc
  `);
}

export async function notes(kind: ZrmKind, id: string): Promise<Note[]> {
  const sql = db();
  const result =
    kind === "people"
      ? await sql`select id, body, author_email, created_at from zrm_notes where person_id = ${id} order by created_at desc`
      : kind === "companies"
        ? await sql`select id, body, author_email, created_at from zrm_notes where company_id = ${id} order by created_at desc`
        : await sql`select id, body, author_email, created_at from zrm_notes where opportunity_id = ${id} order by created_at desc`;
  return rows<Note>(result);
}

export async function companyPeople(companyId: string): Promise<Related[]> {
  return rows<Related>(await db()`
    select id, coalesce(nullif(concat_ws(' ', first_name, last_name), ''), 'Unnamed') as label, title as detail
    from zrm_people where company_id = ${companyId}
    order by lower(coalesce(first_name, '')), lower(coalesce(last_name, ''))
  `);
}

/** A person's or company's opportunities, with their stage and value as the detail. */
export async function relatedOpportunities(column: "person_id" | "company_id", id: string): Promise<Related[]> {
  const sql = db();
  const result =
    column === "person_id"
      ? await sql`
          select o.id, o.title as label, concat_ws(' · ', s.name, to_char(o.value, 'FM$999,999,999,990')) as detail
          from zrm_opportunities o join zrm_stages s on s.id = o.stage_id
          where o.person_id = ${id} order by o.updated_at desc`
      : await sql`
          select o.id, o.title as label, concat_ws(' · ', s.name, to_char(o.value, 'FM$999,999,999,990')) as detail
          from zrm_opportunities o join zrm_stages s on s.id = o.stage_id
          where o.company_id = ${id} order by o.updated_at desc`;
  return rows<Related>(result);
}
