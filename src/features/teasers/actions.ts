"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getDeployment } from "@/features/deployments/deployments";
import { userIdFor } from "@/features/users/users";
import { isUuid, teamAccount } from "@/features/zrm/access";
import { isEmail, multiLine, singleLine } from "@/lib/validation";
import { TEASERS_TAG, deleteTeaser, saveTeaser } from "./teasers";
import { LIMITS, type TeaserInput } from "./types";

export interface TeaserFormState {
  error?: string;
}

const text = (value: FormDataEntryValue | null | undefined): string =>
  typeof value === "string" ? singleLine(value) : "";

/**
 * Rows from parallel `<prefix>_<column>` fields, blank rows skipped; a string
 * is the error. `columns` maps each column to its character limit.
 */
function readRows<Column extends string>(
  formData: FormData,
  prefix: string,
  columns: Record<Column, number>,
  maxRows: number,
  noun: string,
): Record<Column, string>[] | string {
  const keys = Object.keys(columns) as Column[];
  const values = Object.fromEntries(keys.map((key) => [key, formData.getAll(`${prefix}_${key}`)])) as Record<
    Column,
    FormDataEntryValue[]
  >;
  const count = Math.max(...keys.map((key) => values[key].length));
  const rows: Record<Column, string>[] = [];
  for (let i = 0; i < count; i++) {
    const row = Object.fromEntries(keys.map((key) => [key, text(values[key][i])])) as Record<Column, string>;
    if (keys.every((key) => !row[key])) continue;
    const long = keys.find((key) => row[key].length > columns[key]);
    if (long) return `A ${noun} is too long; keep each ${long} to ${columns[long]} characters.`;
    rows.push(row);
  }
  if (rows.length > maxRows) return `A teaser fits at most ${maxRows} ${noun}s on its page.`;
  return rows;
}

function readTeaser(formData: FormData): TeaserInput | string {
  const field = (key: string) => text(formData.get(key));
  const within = (value: string, max: number, label: string) =>
    value.length > max ? `${label} is too long; keep it to ${max} characters.` : null;

  const name = field("name");
  const headline = field("headline");
  if (!name) return "Name the teaser.";
  if (!headline) return "Give the teaser a headline.";
  const eyebrow = field("eyebrow");
  const subheadline = field("subheadline");
  const summary = typeof formData.get("summary") === "string" ? multiLine(formData.get("summary") as string) : "";
  const contactName = field("contact_name");
  const contactEmail = field("contact_email");
  for (const problem of [
    within(name, LIMITS.name, "The name"),
    within(eyebrow, LIMITS.eyebrow, "The eyebrow"),
    within(headline, LIMITS.headline, "The headline"),
    within(subheadline, LIMITS.subheadline, "The subheadline"),
    within(summary, LIMITS.summary, "The overview"),
    within(contactName, LIMITS.contactName, "The contact's name"),
    within(contactEmail, LIMITS.contactEmail, "The contact's email"),
  ]) {
    if (problem) return problem;
  }
  if (contactEmail && !isEmail(contactEmail)) return "The contact's email doesn't look right.";

  const rawHighlights = typeof formData.get("highlights") === "string" ? (formData.get("highlights") as string) : "";
  const highlights = rawHighlights
    .split("\n")
    .map((line) => singleLine(line).replace(/^[-•*]\s*/, ""))
    .filter(Boolean);
  if (highlights.length > LIMITS.highlights) return `A teaser fits at most ${LIMITS.highlights} highlights.`;
  if (highlights.some((line) => line.length > LIMITS.highlight)) {
    return `Keep each highlight to ${LIMITS.highlight} characters.`;
  }

  const stats = readRows(formData, "stat", { value: LIMITS.statValue, label: LIMITS.statLabel }, LIMITS.stats, "key figure");
  if (typeof stats === "string") return stats;
  const availability = readRows(
    formData,
    "availability",
    { label: LIMITS.availabilityLabel, capacity: LIMITS.availabilityCapacity, date: LIMITS.availabilityDate },
    LIMITS.availability,
    "availability row",
  );
  if (typeof availability === "string") return availability;
  const specs = readRows(formData, "spec", { label: LIMITS.specLabel, value: LIMITS.specValue }, LIMITS.specs, "spec");
  if (typeof specs === "string") return specs;
  const terms = readRows(formData, "term", { label: LIMITS.termLabel, value: LIMITS.termValue }, LIMITS.terms, "term");
  if (typeof terms === "string") return terms;

  const deploymentId = field("deployment_id");
  return {
    name,
    deploymentId: isUuid(deploymentId) ? deploymentId : null,
    eyebrow,
    headline,
    subheadline,
    stats,
    summary,
    highlights: highlights.join("\n"),
    availability,
    specs,
    terms,
    contactName,
    contactEmail,
  };
}

/** Creates a teaser, or saves the one in `id`, then opens it with its preview. The ZODE team only. */
export async function saveTeaserAction(_prev: TeaserFormState, formData: FormData): Promise<TeaserFormState> {
  const account = await teamAccount();
  if (!account) return { error: "You don't have access to this. Try reloading the page." };

  const rawId = text(formData.get("id"));
  if (rawId && !isUuid(rawId)) return { error: "This teaser no longer exists." };

  const input = readTeaser(formData);
  if (typeof input === "string") return { error: input };
  if (input.deploymentId && !(await getDeployment(input.deploymentId))) input.deploymentId = null;

  const id = await saveTeaser(rawId || null, input, await userIdFor(account.userId));
  if (!id) return { error: "This teaser was deleted. Reload to see the current list." };

  updateTag(TEASERS_TAG);
  redirect(`/portal/deployments/teasers/${id}`);
}

/** Deletes a teaser, then opens the list. The ZODE team only. */
export async function deleteTeaserAction(id: string): Promise<TeaserFormState> {
  const account = await teamAccount();
  if (!account) return { error: "You don't have access to this. Try reloading the page." };
  if (!isUuid(id)) return { error: "This teaser no longer exists." };
  await deleteTeaser(id);
  updateTag(TEASERS_TAG);
  redirect("/portal/deployments/teasers");
}
