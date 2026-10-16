"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { blobInfo, deleteBlobs } from "@/features/data-room/blob";
import { recordTeamSnapshot } from "@/features/team-dashboard/metrics";
import { userIdFor } from "@/features/users/users";
import { isUuid, teamAccount } from "@/features/zrm/access";
import { ZRM_TAGS } from "@/features/zrm/queries";
import { multiLine, singleLine } from "@/lib/validation";
import { COMPUTE_CONTRACT_PREFIX, createComputeDeal, isComputeOpportunity, isRecordedContractBlob } from "./contracts";
import { isDealStructure } from "./deals";

export interface ContractFormState {
  error?: string;
}

const MAX_TEXT = 200;
const MAX_NOTES = 5_000;
const MAX_DOCUMENTS = 10;

const text = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === "string" ? singleLine(value) : "";
};

/** An optional non-negative figure, with `$`, `%` and thousands separators allowed. */
function figure(formData: FormData, key: string, label: string, max: number, whole = false): number | null | string {
  const raw = text(formData, key).replace(/[$,%\s]/g, "");
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value >= max || (whole && !Number.isInteger(value))) {
    return `${label} must be ${whole ? "a whole number" : "a number"}.`;
  }
  return value;
}

/** An optional `YYYY-MM-DD` date, or the error to show. */
function dateField(formData: FormData, key: string, label: string): string | null | { error: string } {
  const value = text(formData, key);
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : { error: `${label} must be a date.` };
}

/**
 * Records an executed compute deal whose PDFs the browser has already
 * uploaded (`document_pathname`, each with a `document_label`), closes its
 * opportunity, then opens All contracts. A rejected form deletes the uploads,
 * so a failed attempt leaves nothing behind.
 */
export async function recordComputeDealAction(_prev: ContractFormState, formData: FormData): Promise<ContractFormState> {
  const account = await teamAccount();
  if (!account) return { error: "You don't have access to this. Try reloading the page." };

  const pathnames = formData.getAll("document_pathname").map((value) => (typeof value === "string" ? value : ""));
  const labels = formData.getAll("document_label").map((value) => (typeof value === "string" ? singleLine(value) : ""));
  if (!pathnames.length || pathnames.length > MAX_DOCUMENTS || labels.length !== pathnames.length) {
    return { error: "Attach the executed documents as PDFs." };
  }
  if (pathnames.some((pathname) => !pathname.startsWith(COMPUTE_CONTRACT_PREFIX) || pathname.includes(".."))) {
    return { error: "Attach the executed documents as PDFs." };
  }
  if (new Set(pathnames).size !== pathnames.length || (await isRecordedContractBlob(pathnames))) {
    return { error: "One of those PDFs is already recorded. Attach them again." };
  }
  const fail = async (error: string): Promise<ContractFormState> => {
    await deleteBlobs(pathnames);
    return { error };
  };

  if (labels.some((label) => !label)) return fail("Name each document, e.g. MSA or Order Form.");
  if (labels.some((label) => label.length > MAX_TEXT)) return fail("A document name is too long.");

  const counterparty = text(formData, "counterparty");
  if (!counterparty) return fail("Counterparty is required.");
  const providerEntity = text(formData, "provider_entity") || null;
  const gpuModel = text(formData, "gpu_model") || null;
  const location = text(formData, "location") || null;
  for (const value of [counterparty, providerEntity, gpuModel, location]) {
    if (value && value.length > MAX_TEXT) return fail("One of the fields is too long.");
  }

  const signedOn = dateField(formData, "signed_on", "Signed");
  if (!signedOn) return fail("Signed date is required.");
  const dates = {
    effectiveOn: dateField(formData, "effective_on", "Effective"),
    msaOn: dateField(formData, "msa_on", "MSA date"),
    deliveryOn: dateField(formData, "delivery_on", "Delivery"),
    acceptanceDeadlineOn: dateField(formData, "acceptance_deadline_on", "Acceptance deadline"),
    prepaymentDueOn: dateField(formData, "prepayment_due_on", "Prepayment due"),
  };
  for (const value of [signedOn, ...Object.values(dates)]) {
    if (value && typeof value === "object") return fail(value.error);
  }

  const opportunityId = text(formData, "opportunity_id");
  if (!opportunityId) return fail("Choose the Compute opportunity this deal closes.");
  const siteId = text(formData, "site_id") || null;
  if (!isUuid(opportunityId) || (siteId && !isUuid(siteId)) || !(await isComputeOpportunity(opportunityId))) {
    return fail("A linked record no longer exists. Reload and try again.");
  }

  const rawStructure = text(formData, "structure");
  if (rawStructure && !isDealStructure(rawStructure)) return fail("Choose how the deal is paid.");
  const structure = isDealStructure(rawStructure) ? rawStructure : null;

  const figures = {
    gpuCount: figure(formData, "gpu_count", "GPUs", 1e7, true),
    nodeCount: figure(formData, "node_count", "Nodes", 1e6, true),
    itMw: figure(formData, "it_mw", "IT MW", 1e6),
    gpuHourUsd: figure(formData, "gpu_hour_usd", "GPU-hour rate", 1e4),
    termMonths: figure(formData, "term_months", "Term", 1200, true),
    renewalMonths: figure(formData, "renewal_months", "Renewal", 1200, true),
    valueUsd: figure(formData, "value_usd", "Total value", 1e14),
    prepaymentUsd: figure(formData, "prepayment_usd", "Prepayment", 1e14),
    uptimePct: figure(formData, "uptime_pct", "Uptime", 100.01),
  };
  for (const value of Object.values(figures)) {
    if (typeof value === "string") return fail(value);
  }

  const rawNotes = formData.get("notes");
  const notes = typeof rawNotes === "string" ? multiLine(rawNotes) : "";
  if (notes.length > MAX_NOTES) return fail("Notes are too long.");

  const infos = await Promise.all(pathnames.map((pathname) => blobInfo(pathname)));
  if (infos.some((info) => !info)) return { error: "An upload didn't finish. Try again." };
  if (infos.some((info) => info!.contentType !== "application/pdf")) return fail("Each document must be a PDF.");

  try {
    await createComputeDeal({
      signedOn: signedOn as string,
      counterparty,
      providerEntity,
      opportunityId,
      siteId,
      ...(dates as Record<keyof typeof dates, string | null>),
      gpuModel,
      location,
      structure,
      ...(figures as Record<keyof typeof figures, number | null>),
      notes: notes || null,
      documents: pathnames.map((blobPathname, i) => ({ label: labels[i]!, blobPathname })),
      recordedBy: await userIdFor(account.userId),
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23503") {
      return fail("A linked record no longer exists. Reload and try again.");
    }
    await deleteBlobs(pathnames);
    throw error;
  }

  await recordTeamSnapshot().catch((error: unknown) => console.error("[contracts] snapshot failed", error));
  updateTag(ZRM_TAGS.opportunities);
  updateTag(ZRM_TAGS.detail);
  revalidatePath("/portal/contracts", "layout");
  revalidatePath("/portal/team");
  redirect("/portal/contracts/all");
}
