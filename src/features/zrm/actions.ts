"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isEmail, multiLine, singleLine } from "@/lib/validation";
import { isUuid, teamAccount } from "./access";
import { CHILDREN, TABLES, fieldsFor, isChildKind, type ChildKind, type FieldSpec } from "./fields";
import { isKind, recordHref, type ActionState, type ZrmKind } from "./types";

const NO_ACCESS: ActionState = { error: "You don't have access to ZRM. Try reloading the page." };
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
    case "money": {
      const number = Number(value.replace(/[$,\s]/g, ""));
      return Number.isFinite(number) && number >= 0 && number < 1e12 ? { value: number } : fail("must be an amount");
    }
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? { value } : fail("must be a date");
    case "company":
    case "person":
    case "stage":
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

const revalidate = () => revalidatePath("/portal/zrm", "layout");

/**
 * Saves one section of a record's fields, or creates the record from the New
 * form (`section` "create") and opens it. Column names come only from the
 * field specs, never from the request.
 */
export async function saveFieldsAction(
  kind: ZrmKind,
  id: string | null,
  section: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await teamAccount())) return NO_ACCESS;
  const fields = isKind(kind) ? fieldsFor(kind, section) : undefined;
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
    revalidate();
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
  revalidate();
  return { saved: true };
}

export async function deleteRecordAction(kind: ZrmKind, id: string): Promise<ActionState> {
  if (!(await teamAccount())) return NO_ACCESS;
  if (!isKind(kind) || !isUuid(id)) return NO_ACCESS;
  await db().query(`delete from ${TABLES[kind]} where id = $1`, [id]);
  revalidate();
  redirect(`/portal/zrm/${kind}`);
}

/** Pins a record to the top of its list, or unpins it. */
export async function setActiveAction(kind: ZrmKind, id: string, active: boolean): Promise<ActionState> {
  if (!(await teamAccount())) return NO_ACCESS;
  if (!isKind(kind) || !isUuid(id)) return NO_ACCESS;
  await db().query(`update ${TABLES[kind]} set active = $1, updated_at = now() where id = $2`, [active === true, id]);
  revalidate();
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
  revalidate();
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
  revalidate();
  return { saved: true };
}

/** Adds a work history entry, school, custom field, activity or note under a record. */
export async function addChildAction(
  child: ChildKind,
  kind: ZrmKind,
  parentId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const account = await teamAccount();
  if (!account) return NO_ACCESS;
  const spec = isChildKind(child) ? CHILDREN[child] : undefined;
  const parent = spec && isKind(kind) ? spec.parents[kind] : undefined;
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
