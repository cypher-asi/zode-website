"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isEmail, multiLine, singleLine } from "@/lib/validation";
import { isUuid, teamAccount } from "./access";
import { CHILDREN, SITE_MENU_FIELDS, TABLES, fieldsFor, isChildKind, type ChildKind, type FieldSpec } from "./fields";
import { ZRM_TAGS } from "./queries";
import { isRecordKind, listHref, recordHref, type ActionState, type RecordKind } from "./types";

const NO_ACCESS: ActionState = { error: "You don't have access to this. Try reloading the page." };
const MISSING: ActionState = { error: "That record no longer exists. Try reloading the page." };

const MAX_TEXT = 500;
const MAX_LONG_TEXT = 20_000;
const MAX_LIST_ITEMS = 100;

type Value = string | number | string[] | null;

/** A submitted value, cleaned and checked against its field's type. */
function parseField(field: FieldSpec, raw: FormDataEntryValue | null): { value: Value } | { error: string } {
  const input = typeof raw === "string" ? raw : "";
  const fail = (problem: string) => ({ error: `${field.label} ${problem}.` });

  if (field.type === "list") {
    const items = [...new Set(input.split(/[,\n]/).map(singleLine).filter(Boolean))];
    if (items.length > MAX_LIST_ITEMS || items.some((item) => item.length > MAX_TEXT)) return fail("is too long");
    return { value: items };
  }

  const value = field.type === "textarea" ? multiLine(input) : singleLine(input);
  if (!value) return field.required ? fail("is required") : { value: null };
  if (value.length > (field.type === "textarea" ? MAX_LONG_TEXT : MAX_TEXT)) return fail("is too long");

  switch (field.type) {
    case "email":
      return isEmail(value) ? { value } : fail("isn't a valid email address");
    case "url": {
      const href = /^https?:\/\//i.test(value) ? value : `https://${value}`;
      try {
        new URL(href);
        return { value: href };
      } catch {
        return fail("isn't a valid link");
      }
    }
    case "int": {
      const number = Number(value.replace(/[,\s]/g, ""));
      return Number.isSafeInteger(number) && number >= 0 && number < 2 ** 31 ? { value: number } : fail("must be a whole number");
    }
    case "decimal": {
      const number = Number(value.replace(/[$,\s]/g, ""));
      return Number.isFinite(number) && Math.abs(number) < 1e8 ? { value: number } : fail("must be a number");
    }
    case "money": {
      const number = Number(value.replace(/[$,\s]/g, ""));
      return Number.isFinite(number) && number >= 0 && number < 1e12 ? { value: number } : fail("must be an amount");
    }
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? { value } : fail("must be a date");
    case "choice":
      return field.options?.includes(value) ? { value } : fail("isn't one of the choices");
    case "company":
    case "person":
    case "stage":
    case "status":
    case "room":
      return isUuid(value) ? { value } : fail("isn't one of the choices");
    default:
      return { value };
  }
}

function parseFields(fields: readonly FieldSpec[], formData: FormData): Map<string, Value> | { error: string } {
  const values = new Map<string, Value>();
  for (const field of fields) {
    const parsed = parseField(field, formData.get(field.key));
    if ("error" in parsed) return parsed;
    values.set(field.key, parsed.value);
  }
  return values;
}

/** Postgres error codes for a foreign key or check that a stale form can trip. */
const isStaleReference = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && (error.code === "23503" || error.code === "23514");

/** The lists that show a kind's columns: people and opportunities show their company's name and types, and so on. */
const LISTS_SHOWING: Record<RecordKind | "types" | "stages", readonly string[]> = {
  people: [ZRM_TAGS.people, ZRM_TAGS.opportunities],
  companies: [ZRM_TAGS.companies, ZRM_TAGS.people, ZRM_TAGS.opportunities, ZRM_TAGS.sites],
  opportunities: [ZRM_TAGS.opportunities],
  sites: [ZRM_TAGS.sites],
  types: [ZRM_TAGS.lookups, ZRM_TAGS.companies, ZRM_TAGS.people, ZRM_TAGS.opportunities],
  stages: [ZRM_TAGS.lookups, ZRM_TAGS.opportunities],
};

/**
 * Refreshes every record's detail, which shows its relatives' names, and the
 * lists `changed` appears in; a child (note, school, ...) only changes details.
 */
const revalidate = (changed?: keyof typeof LISTS_SHOWING) => {
  updateTag(ZRM_TAGS.detail);
  for (const tag of changed ? LISTS_SHOWING[changed] : []) updateTag(tag);
};

/**
 * Saves one section of a record's fields, or creates the record from the New
 * form (`section` "create") and opens it. Column names come only from the
 * field specs, never from the request.
 */
export async function saveFieldsAction(
  kind: RecordKind,
  id: string | null,
  section: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await teamAccount())) return NO_ACCESS;
  const fields = isRecordKind(kind) ? fieldsFor(kind, section) : undefined;
  if (!fields || (id !== null && !isUuid(id))) return NO_ACCESS;

  const values = parseFields(fields, formData);
  if ("error" in values) return values;
  const columns = [...values.keys()];
  const params = [...values.values()];
  const table = TABLES[kind];
  const sql = db();

  if (id === null) {
    let createdId: string;
    try {
      const [row] = await sql.query(
        `insert into ${table} (${columns.map((c) => `"${c}"`).join(", ")})
         values (${columns.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
        params,
      );
      createdId = row!.id as string;
    } catch (error) {
      if (isStaleReference(error)) return { error: "A linked record no longer exists. Reload and try again." };
      throw error;
    }
    revalidate(kind);
    redirect(recordHref(kind, createdId));
  }

  try {
    const result = await sql.query(
      `update ${table} set ${columns.map((c, i) => `"${c}" = $${i + 1}`).join(", ")}, updated_at = now()
       where id = $${columns.length + 1} returning id`,
      [...params, id],
    );
    if (result.length === 0) return MISSING;
  } catch (error) {
    if (isStaleReference(error)) return { error: "A linked record no longer exists. Reload and try again." };
    throw error;
  }
  revalidate(kind);
  return { saved: true };
}

export async function deleteRecordAction(kind: RecordKind, id: string): Promise<ActionState> {
  if (!(await teamAccount())) return NO_ACCESS;
  if (!isRecordKind(kind) || !isUuid(id)) return NO_ACCESS;
  await db().query(`delete from ${TABLES[kind]} where id = $1`, [id]);
  revalidate(kind);
  redirect(listHref(kind));
}

/** Pins a record to the top of its list, or unpins it. */
export async function setActiveAction(kind: RecordKind, id: string, active: boolean): Promise<ActionState> {
  if (!(await teamAccount())) return NO_ACCESS;
  if (!isRecordKind(kind) || !isUuid(id)) return NO_ACCESS;
  await db().query(`update ${TABLES[kind]} set active = $1, updated_at = now() where id = $2`, [active === true, id]);
  revalidate(kind);
  return { saved: true };
}

export async function setStageAction(id: string, stageId: string): Promise<ActionState> {
  if (!(await teamAccount())) return NO_ACCESS;
  if (!isUuid(id) || !isUuid(stageId)) return NO_ACCESS;
  try {
    await db()`update zrm_opportunities set stage_id = ${stageId}, updated_at = now() where id = ${id}`;
  } catch (error) {
    if (isStaleReference(error)) return { error: "That stage no longer exists. Reload and try again." };
    throw error;
  }
  revalidate("opportunities");
  return { saved: true };
}

export async function setSiteStatusAction(id: string, statusId: string): Promise<ActionState> {
  if (!(await teamAccount())) return NO_ACCESS;
  if (!isUuid(id) || !isUuid(statusId)) return NO_ACCESS;
  try {
    await db()`update capacity_sites set status_id = ${statusId}, updated_at = now() where id = ${id}`;
  } catch (error) {
    if (isStaleReference(error)) return { error: "That status no longer exists. Reload and try again." };
    throw error;
  }
  revalidate("sites");
  return { saved: true };
}

/** Sets one of the fields a site's right-click menu offers, or clears it with an empty value. */
export async function setSiteFieldAction(id: string, key: string, value: string): Promise<ActionState> {
  if (!(await teamAccount())) return NO_ACCESS;
  const field = SITE_MENU_FIELDS.find((f) => f.key === key);
  if (!field || !isUuid(id)) return NO_ACCESS;
  const parsed = parseField(field, value);
  if ("error" in parsed) return parsed;
  try {
    const result = await db().query(`update capacity_sites set "${field.key}" = $1, updated_at = now() where id = $2 returning id`, [
      parsed.value,
      id,
    ]);
    if (result.length === 0) return MISSING;
  } catch (error) {
    if (isStaleReference(error)) return { error: `That ${field.label.toLowerCase()} no longer exists. Reload and try again.` };
    throw error;
  }
  revalidate("sites");
  return { saved: true };
}

/** Replaces a company's types with the checked ones, adding a new type first if one was named. */
export async function setCompanyTypesAction(companyId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await teamAccount())) return NO_ACCESS;
  if (!isUuid(companyId)) return NO_ACCESS;
  const typeIds = formData.getAll("type").filter(isUuid);
  const newName = singleLine(String(formData.get("new_type") ?? ""));
  if (newName.length > 60) return { error: "That type name is too long." };

  const sql = db();
  if (newName) {
    const [row] = await sql`
      insert into zrm_types (name) values (${newName})
      on conflict (name) do update set updated_at = now()
      returning id
    `;
    typeIds.push(row!.id as string);
  }
  try {
    await sql.transaction([
      sql`delete from zrm_company_types where company_id = ${companyId}`,
      sql`
        insert into zrm_company_types (company_id, type_id)
        select ${companyId}, t.id from zrm_types t where t.id = any(${typeIds}::uuid[])
        on conflict do nothing
      `,
      sql`update zrm_companies set updated_at = now() where id = ${companyId}`,
    ]);
  } catch (error) {
    if (isStaleReference(error)) return MISSING;
    throw error;
  }
  revalidate("types");
  return { saved: true };
}

/** Adds a work history entry, school, custom field, activity or note under a record. */
export async function addChildAction(
  child: ChildKind,
  kind: RecordKind,
  parentId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const account = await teamAccount();
  if (!account) return NO_ACCESS;
  const spec = isChildKind(child) ? CHILDREN[child] : undefined;
  const parent = spec && isRecordKind(kind) ? spec.parents[kind] : undefined;
  if (!spec || !parent || !isUuid(parentId)) return NO_ACCESS;

  const values = parseFields(spec.fields, formData);
  if ("error" in values) return values;
  // Left out so the column defaults apply, e.g. an activity dated now.
  for (const [key, value] of values) if (value === null) values.delete(key);
  values.set(parent, parentId);
  if (child === "note") {
    values.set("author_user_id", account.userId);
    values.set("author_email", account.email);
  }

  const columns = [...values.keys()];
  const params = [...values.values()];
  const placeholders = columns.map((_, i) => `$${i + 1}`);
  if (spec.ordered) {
    columns.push("position");
    placeholders.push(`coalesce((select max(position) + 1 from ${spec.table} where "${parent}" = $${params.length + 1}), 0)`);
    params.push(parentId);
  }

  try {
    await db().query(
      `insert into ${spec.table} (${columns.map((c) => `"${c}"`).join(", ")}) values (${placeholders.join(", ")})`,
      params,
    );
  } catch (error) {
    if (isStaleReference(error)) return MISSING;
    throw error;
  }
  revalidate();
  return { saved: true };
}

export async function deleteChildAction(child: ChildKind, id: string): Promise<ActionState> {
  if (!(await teamAccount())) return NO_ACCESS;
  if (!isChildKind(child) || !isUuid(id)) return NO_ACCESS;
  await db().query(`delete from ${CHILDREN[child].table} where id = $1`, [id]);
  revalidate();
  return { saved: true };
}
