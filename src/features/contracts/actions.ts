"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { blobInfo, deleteBlobs } from "@/features/data-room/blob";
import { recordTeamSnapshot } from "@/features/team-dashboard/metrics";
import { userIdFor } from "@/features/users/users";
import { isUuid, teamAccount } from "@/features/zrm/access";
import { multiLine, singleLine } from "@/lib/validation";
import { COMPUTE_CONTRACT_PREFIX, createComputeContract, isRecordedContractBlob } from "./contracts";

export interface ContractFormState {
  error?: string;
}

const MAX_TEXT = 200;
const MAX_NOTES = 5_000;

const text = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === "string" ? singleLine(value) : "";
};

/** An optional non-negative figure, with `$` and thousands separators allowed. */
function figure(formData: FormData, key: string, label: string, max: number, whole = false): number | null | string {
  const raw = text(formData, key).replace(/[$,\s]/g, "");
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value >= max || (whole && !Number.isInteger(value))) {
    return `${label} must be ${whole ? "a whole number" : "a number"}.`;
  }
  return value;
}

/**
 * Records an executed compute contract whose PDF the browser has already
 * uploaded to `pdf_pathname`, then opens All contracts. A rejected form
 * deletes the upload, so a failed attempt leaves nothing behind.
 */
export async function recordComputeContractAction(
  _prev: ContractFormState,
  formData: FormData,
): Promise<ContractFormState> {
  const account = await teamAccount();
  if (!account) return { error: "You don't have access to this. Try reloading the page." };

  const pathname = text(formData, "pdf_pathname");
  if (!pathname.startsWith(COMPUTE_CONTRACT_PREFIX) || pathname.includes("..")) {
    return { error: "Attach the executed contract as a PDF." };
  }
  if (await isRecordedContractBlob(pathname)) return { error: "That PDF is already recorded. Attach it again." };
  const fail = async (error: string): Promise<ContractFormState> => {
    await deleteBlobs([pathname]);
    return { error };
  };

  const counterparty = text(formData, "counterparty");
  if (!counterparty) return fail("Counterparty is required.");
  if (counterparty.length > MAX_TEXT) return fail("Counterparty is too long.");

  const signedOn = text(formData, "signed_on");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(signedOn) || Number.isNaN(Date.parse(signedOn))) {
    return fail("Signed date must be a date.");
  }

  const mode = text(formData, "mode");
  if (mode !== "buy" && mode !== "rent") return fail("Choose whether it's a purchase or a rental.");

  const link = (key: string): string | null | false => {
    const value = text(formData, key);
    return !value ? null : isUuid(value) ? value : false;
  };
  const opportunityId = link("opportunity_id");
  const siteId = link("site_id");
  if (opportunityId === false || siteId === false) return fail("A linked record no longer exists. Reload and try again.");

  const itMw = figure(formData, "it_mw", "IT MW", 1e6);
  const valueUsd = figure(formData, "value_usd", "Total value", 1e14);
  const monthlyUsd = figure(formData, "monthly_usd", "Monthly", 1e12);
  const termMonths = figure(formData, "term_months", "Term", 1200, true);
  for (const value of [itMw, valueUsd, monthlyUsd, termMonths]) {
    if (typeof value === "string") return fail(value);
  }

  const rawNotes = formData.get("notes");
  const notes = typeof rawNotes === "string" ? multiLine(rawNotes) : "";
  if (notes.length > MAX_NOTES) return fail("Notes are too long.");

  const info = await blobInfo(pathname);
  if (!info) return { error: "The upload didn't finish. Try again." };
  if (info.contentType !== "application/pdf") return fail("The contract must be a PDF.");

  try {
    await createComputeContract({
      signedOn,
      counterparty,
      mode,
      opportunityId,
      siteId,
      itMw: itMw as number | null,
      valueUsd: valueUsd as number | null,
      monthlyUsd: monthlyUsd as number | null,
      termMonths: termMonths as number | null,
      notes: notes || null,
      blobPathname: pathname,
      recordedBy: await userIdFor(account.userId),
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23503") {
      return fail("A linked record no longer exists. Reload and try again.");
    }
    await deleteBlobs([pathname]);
    throw error;
  }

  await recordTeamSnapshot().catch((error: unknown) => console.error("[contracts] snapshot failed", error));
  revalidatePath("/portal/contracts", "layout");
  revalidatePath("/portal/team");
  redirect("/portal/contracts/all");
}
