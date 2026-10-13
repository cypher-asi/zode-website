"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { userIdFor } from "@/features/users/users";
import { isUuid, teamAccount } from "@/features/zrm/access";
import { multiLine, singleLine } from "@/lib/validation";
import { DEPLOYMENTS_TAG, deleteDeployment, saveDeployment, type DeploymentInput } from "./deployments";
import {
  COOLING,
  CREDIT_RATINGS,
  FACILITIES,
  NETWORKING,
  NODE_OPTIONS,
  PLATFORM_OPTIONS,
  STATUSES,
  STORAGE_OPTIONS,
  isOption,
  type Phase,
} from "./types";

export interface DeploymentFormState {
  error?: string;
}

const MAX_TEXT = 200;
const MAX_ADDRESS = 500;
const MAX_NOTES = 5_000;
const MAX_PHASES = 24;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const text = (value: FormDataEntryValue | null | undefined): string =>
  typeof value === "string" ? singleLine(value) : "";

/** An optional non-negative figure, with `$` and thousands separators allowed; a string is the error. */
function figure(raw: string, label: string, max: number, whole = false): number | null | string {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0 || value >= max || (whole && !Number.isInteger(value))) {
    return `${label} must be ${whole ? "a whole number" : "a number"}.`;
  }
  return value;
}

const isDay = (value: string): boolean => DAY_RE.test(value) && !Number.isNaN(Date.parse(value));

/** The rollout, one phase per row of `phase_*` fields in order; blank rows are skipped. */
function readPhases(formData: FormData): Phase[] | string {
  const names = formData.getAll("phase_name");
  const starts = formData.getAll("phase_start_on");
  const rfs = formData.getAll("phase_rfs_on");
  const nodes = formData.getAll("phase_nodes");
  const mws = formData.getAll("phase_mw");
  const phases: Phase[] = [];
  for (let i = 0; i < rfs.length; i++) {
    const row = {
      name: text(names[i]),
      startOn: text(starts[i]),
      rfsOn: text(rfs[i]),
      nodes: text(nodes[i]),
      mw: text(mws[i]),
    };
    if (!row.name && !row.startOn && !row.rfsOn && !row.nodes && !row.mw) continue;
    const label = row.name || `Phase ${phases.length + 1}`;
    if (row.name.length > MAX_TEXT) return `${label}'s name is too long.`;
    if (!isDay(row.rfsOn)) return `${label} needs an RFS date.`;
    if (row.startOn && !isDay(row.startOn)) return `${label}'s start must be a date.`;
    if (row.startOn && row.startOn > row.rfsOn) return `${label} must start on or before its RFS date.`;
    const phaseNodes = figure(row.nodes, `${label}'s nodes`, 1e6, true);
    if (typeof phaseNodes === "string") return phaseNodes;
    if (phaseNodes === null) return `${label} needs a node count.`;
    const mw = figure(row.mw, `${label}'s MW`, 1e6);
    if (typeof mw === "string") return mw;
    phases.push({ name: row.name || null, startOn: row.startOn || null, rfsOn: row.rfsOn, nodes: phaseNodes, mw });
  }
  if (phases.length > MAX_PHASES) return `A deployment can have at most ${MAX_PHASES} phases.`;
  return phases.sort((a, b) => a.rfsOn.localeCompare(b.rfsOn));
}

function readDeployment(formData: FormData): DeploymentInput | string {
  const field = (key: string) => text(formData.get(key));

  const name = field("name");
  if (!name) return "Name is required.";
  if (name.length > MAX_TEXT) return "Name is too long.";

  const status = field("status");
  const platform = field("platform");
  const cooling = field("cooling");
  const networking = field("networking");
  if (!isOption(STATUSES, status)) return "Choose a status.";
  if (!isOption(PLATFORM_OPTIONS, platform)) return "Choose a platform.";
  if (!isOption(COOLING, cooling)) return "Choose the cooling.";
  if (!isOption(NETWORKING, networking)) return "Choose the networking.";

  const nodes = Number(field("nodes"));
  if (!NODE_OPTIONS.includes(nodes)) return "Choose one of the standard node counts.";
  const storageTbPerNode = Number(field("storage_tb_per_node"));
  if (!STORAGE_OPTIONS.includes(storageTbPerNode)) return "Choose the storage per node.";

  const facility = field("facility");
  if (facility && !isOption(FACILITIES, facility)) return "Choose the facility type.";
  const creditRating = field("credit_rating");
  if (creditRating && !isOption(CREDIT_RATINGS, creditRating)) return "Choose the credit requirement.";

  const address = typeof formData.get("address") === "string" ? multiLine(formData.get("address") as string) : "";
  if (address.length > MAX_ADDRESS) return "The address is too long.";
  const notes = typeof formData.get("notes") === "string" ? multiLine(formData.get("notes") as string) : "";
  if (notes.length > MAX_NOTES) return "Notes are too long.";

  const termMonths = figure(field("term_months"), "Term", 1200, true);
  const priceGpuHr = figure(field("price_gpu_hr"), "Price", 1e4);
  const depositUsd = figure(field("deposit_usd"), "Deposit", 1e14);
  const locRequired = field("loc_required") === "yes";
  const locAmountUsd = locRequired ? figure(field("loc_amount_usd"), "LOC amount", 1e14) : null;
  for (const value of [termMonths, priceGpuHr, depositUsd, locAmountUsd]) {
    if (typeof value === "string") return value;
  }
  if (termMonths === 0) return "Term must be at least a month.";

  const phases = readPhases(formData);
  if (typeof phases === "string") return phases;
  const scheduled = phases.reduce((sum, phase) => sum + phase.nodes, 0);
  if (scheduled > nodes) return `The phases add up to ${scheduled} nodes, more than the deployment's ${nodes}.`;

  return {
    name,
    status,
    nodes,
    platform,
    cooling,
    networking,
    storageTbPerNode,
    address: address || null,
    facility: facility ? (facility as DeploymentInput["facility"]) : null,
    termMonths: termMonths as number | null,
    priceGpuHr: priceGpuHr as number | null,
    depositUsd: depositUsd as number | null,
    creditRating: creditRating ? (creditRating as DeploymentInput["creditRating"]) : null,
    locRequired,
    locAmountUsd: locAmountUsd as number | null,
    creditGuarantee: field("credit_guarantee") === "yes",
    leaseGuarantee: field("lease_guarantee") === "yes",
    notes: notes || null,
    phases,
  };
}

/** Creates a deployment, or saves the one in `id`, then opens it. The ZODE team only. */
export async function saveDeploymentAction(
  _prev: DeploymentFormState,
  formData: FormData,
): Promise<DeploymentFormState> {
  const account = await teamAccount();
  if (!account) return { error: "You don't have access to this. Try reloading the page." };

  const rawId = text(formData.get("id"));
  if (rawId && !isUuid(rawId)) return { error: "This deployment no longer exists." };

  const input = readDeployment(formData);
  if (typeof input === "string") return { error: input };

  const id = await saveDeployment(rawId || null, input, await userIdFor(account.userId));
  if (!id) return { error: "This deployment was deleted. Reload to see the current list." };

  updateTag(DEPLOYMENTS_TAG);
  redirect(`/portal/deployments/${id}`);
}

/** Deletes a deployment and its phases, then opens the list. The ZODE team only. */
export async function deleteDeploymentAction(id: string): Promise<DeploymentFormState> {
  const account = await teamAccount();
  if (!account) return { error: "You don't have access to this. Try reloading the page." };
  if (!isUuid(id)) return { error: "This deployment no longer exists." };
  await deleteDeployment(id);
  updateTag(DEPLOYMENTS_TAG);
  redirect("/portal/deployments/all");
}
