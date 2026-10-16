"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getDeploymentFor } from "@/features/deployments/deployments";
import { userIdFor } from "@/features/users/users";
import { isUuid, teamAccount } from "@/features/zrm/access";
import { isEmail, multiLine, singleLine } from "@/lib/validation";
import { PRESENTATIONS_TAG, deletePresentation, savePresentation } from "./presentations";
import { LIMITS, linesOf, type PresentationInput, type Section } from "./types";

export interface PresentationFormState {
  error?: string;
}

const text = (value: FormDataEntryValue | null | undefined): string =>
  typeof value === "string" ? singleLine(value) : "";

const long = (value: FormDataEntryValue | null | undefined): string =>
  typeof value === "string" ? multiLine(value) : "";

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
    const over = keys.find((key) => row[key].length > columns[key]);
    if (over) return `A ${noun} is too long; keep each ${over} to ${columns[over]} characters.`;
    rows.push(row);
  }
  if (rows.length > maxRows) return `A slide fits at most ${maxRows} ${noun}s.`;
  return rows;
}

/** A one-per-line field's lines, bullets stripped; a string is the error. */
function readLines(formData: FormData, key: string, max: number, maxLength: number, noun: string): string | { lines: string } {
  const lines = linesOf(long(formData.get(key))).map((line) => singleLine(line).replace(/^[-•*]\s*/, ""));
  if (lines.length > max) return `A slide fits at most ${max} ${noun}s.`;
  if (lines.some((line) => line.length > maxLength)) return `Keep each ${noun} to ${maxLength} characters.`;
  return { lines: lines.join("\n") };
}

function readPresentation(formData: FormData): PresentationInput | string {
  const within = (value: string, max: number, label: string) =>
    value.length > max ? `${label} is too long; keep it to ${max} characters.` : null;

  const title = text(formData.get("title"));
  if (!title) return "Give the presentation a title.";
  const eyebrow = text(formData.get("eyebrow"));
  const subtitle = text(formData.get("subtitle"));
  const summary = long(formData.get("summary"));
  const siteSummary = long(formData.get("site_summary"));
  const clusterSummary = long(formData.get("cluster_summary"));
  const contactName = text(formData.get("contact_name"));
  const contactEmail = text(formData.get("contact_email"));
  for (const problem of [
    within(title, LIMITS.title, "The title"),
    within(eyebrow, LIMITS.eyebrow, "The eyebrow"),
    within(subtitle, LIMITS.subtitle, "The subtitle"),
    within(summary, LIMITS.summary, "The overview"),
    within(siteSummary, LIMITS.siteSummary, "The site's overview"),
    within(clusterSummary, LIMITS.clusterSummary, "The cluster's overview"),
    within(contactName, LIMITS.contactName, "The contact's name"),
    within(contactEmail, LIMITS.contactEmail, "The contact's email"),
  ]) {
    if (problem) return problem;
  }
  if (contactEmail && !isEmail(contactEmail)) return "The contact's email doesn't look right.";

  const highlights = readLines(formData, "highlights", LIMITS.highlights, LIMITS.highlight, "highlight");
  if (typeof highlights === "string") return highlights;
  const nextSteps = readLines(formData, "next_steps", LIMITS.nextSteps, LIMITS.nextStep, "next step");
  if (typeof nextSteps === "string") return nextSteps;

  const stats = readRows(formData, "stat", { value: LIMITS.statValue, label: LIMITS.statLabel }, LIMITS.stats, "key figure");
  if (typeof stats === "string") return stats;
  const factColumns = { label: LIMITS.factLabel, value: LIMITS.factValue };
  const siteFacts = readRows(formData, "site_fact", factColumns, LIMITS.siteFacts, "site fact");
  if (typeof siteFacts === "string") return siteFacts;
  const rollout = readRows(
    formData,
    "rollout",
    { label: LIMITS.rolloutLabel, capacity: LIMITS.rolloutCapacity, power: LIMITS.rolloutPower, date: LIMITS.rolloutDate },
    LIMITS.rollout,
    "phase",
  );
  if (typeof rollout === "string") return rollout;
  const specs = readRows(formData, "spec", factColumns, LIMITS.specs, "spec");
  if (typeof specs === "string") return specs;
  const terms = readRows(formData, "term", { label: LIMITS.termLabel, value: LIMITS.termValue }, LIMITS.terms, "term");
  if (typeof terms === "string") return terms;

  const sections: Section[] = [];
  for (const raw of formData.getAll("section")) {
    const key = typeof raw === "string" && /^\d+$/.test(raw) ? raw : null;
    if (!key) continue;
    const prefix = `section_${key}`;
    const sectionTitle = text(formData.get(`${prefix}_title`));
    const body = long(formData.get(`${prefix}_body`));
    const bullets = readLines(formData, `${prefix}_bullets`, LIMITS.bullets, LIMITS.bullet, "bullet");
    if (typeof bullets === "string") return bullets;
    const facts = readRows(formData, `${prefix}_fact`, factColumns, LIMITS.sectionFacts, "fact");
    if (typeof facts === "string") return facts;
    if (!sectionTitle && !body && !bullets.lines && !facts.length) continue;
    if (!sectionTitle) return "Give every added slide a title, or clear it to drop it.";
    const problem =
      within(sectionTitle, LIMITS.sectionTitle, "An added slide's title") ??
      within(body, LIMITS.sectionBody, `The ${sectionTitle} slide's text`);
    if (problem) return problem;
    sections.push({ title: sectionTitle, body, bullets: bullets.lines, facts });
  }
  if (sections.length > LIMITS.sections) return `A presentation takes at most ${LIMITS.sections} added slides.`;

  return {
    deploymentId: text(formData.get("deployment_id")),
    eyebrow,
    title,
    subtitle,
    stats,
    summary,
    highlights: highlights.lines,
    siteSummary,
    siteFacts,
    rollout,
    clusterSummary,
    specs,
    sections,
    terms,
    nextSteps: nextSteps.lines,
    contactName,
    contactEmail,
  };
}

/** Creates or saves a deployment's presentation, then opens it with its preview. The ZODE team only. */
export async function savePresentationAction(
  _prev: PresentationFormState,
  formData: FormData,
): Promise<PresentationFormState> {
  const account = await teamAccount();
  if (!account) return { error: "You don't have access to this. Try reloading the page." };

  const input = readPresentation(formData);
  if (typeof input === "string") return { error: input };
  if (!isUuid(input.deploymentId) || !(await getDeploymentFor(input.deploymentId, { team: true, userId: account.userId }))) {
    return { error: "This deployment was deleted, and its presentation with it." };
  }

  await savePresentation(input, await userIdFor(account.userId));
  updateTag(PRESENTATIONS_TAG);
  redirect(`/portal/deployments/${input.deploymentId}/presentation`);
}

/** Deletes a deployment's presentation, then opens the deployment. The ZODE team only. */
export async function deletePresentationAction(deploymentId: string): Promise<PresentationFormState> {
  if (!(await teamAccount())) return { error: "You don't have access to this. Try reloading the page." };
  await deletePresentation(deploymentId);
  updateTag(PRESENTATIONS_TAG);
  redirect(`/portal/deployments/${deploymentId}`);
}
