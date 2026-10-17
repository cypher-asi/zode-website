"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { deleteBlobsUnder } from "@/features/data-room/blob";
import { userIdFor } from "@/features/users/users";
import { isUuid, teamAccount } from "@/features/zrm/access";
import { multiLine, singleLine } from "@/lib/validation";
import {
  DEPLOYMENTS_TAG,
  deleteDeployment,
  getDeploymentFor,
  newShareToken,
  roomExists,
  saveDeployment,
  setAccess,
  type DeploymentInput,
} from "./deployments";
import { quoteBlobPrefix } from "./bom/bom";
import {
  CONFIG_FIELDS,
  DEFAULT_CONFIG,
  SYSTEMS,
  optionOf,
  type ColumnConfig,
  type ConfigOverrides,
  type DeploymentConfig,
} from "./config/catalog";
import {
  ACCESS_OPTIONS,
  CREDIT_RATINGS,
  FACILITIES,
  PLATFORM_OPTIONS,
  STATUSES,
  isOption,
  isPlaceId,
  totalsOf,
  type DeploymentAccess,
  type PhaseInput,
  type Platform,
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

type Terms = Pick<PhaseInput, "priceGpuHr" | "termMonths" | "depositPct">;

/**
 * A phase's price per GPU-hour, term in months and deposit percent, each
 * optional; `whose` leads the errors, e.g. "Phase 1's ".
 */
function readTerms(price: string, term: string, deposit: string, whose: string): Terms | string {
  const named = (what: string) => `${whose}${what.toLowerCase()}`;
  const termMonths = figure(term, named("Term"), 1200, true);
  const priceGpuHr = figure(price, named("Price"), 1e4);
  const depositPct = figure(deposit.replace(/%$/, ""), named("Deposit"), 1e3);
  if (typeof termMonths === "string") return termMonths;
  if (typeof priceGpuHr === "string") return priceGpuHr;
  if (typeof depositPct === "string") return depositPct;
  if (termMonths === 0) return `${named("Term")} must be at least a month.`;
  if (depositPct !== null && depositPct > 100) return `${named("Deposit")} can be at most 100% of the contract.`;
  if (depositPct !== null && Math.abs(Math.round(depositPct * 100) - depositPct * 100) > 1e-6) {
    return `${named("Deposit")} can have at most two decimals.`;
  }
  return { priceGpuHr, termMonths, depositPct };
}

const MAX_CONFIG_JSON = 5_000;

/** Settings posted as a JSON object, each checked against its field's options; a string is the error. */
function readSettings(raw: FormDataEntryValue | null | undefined, whose: string): Record<string, unknown> | string {
  if (typeof raw !== "string" || !raw) return {};
  if (raw.length > MAX_CONFIG_JSON) return `${whose} configuration is too long.`;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return `${whose} configuration couldn't be read. Reload and try again.`;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return `${whose} configuration couldn't be read. Reload and try again.`;
  }
  const settings: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    const f = CONFIG_FIELDS.find((candidate) => candidate.key === key);
    if (!f) return `${whose} configuration has a setting that no longer exists. Reload and try again.`;
    const option = optionOf(f, value);
    if (option === undefined) return `${whose} ${f.label.toLowerCase()} isn't an option. Choose another.`;
    settings[key] = option;
  }
  return settings;
}

/**
 * The deployment's configuration from its `configuration` field, split into
 * its JSON and the settings kept in their own columns. Every setting must be
 * given; rack-scale systems are always liquid-cooled.
 */
function readConfig(formData: FormData, platform: Platform): (ColumnConfig & { configuration: DeploymentConfig }) | string {
  const settings = readSettings(formData.get("configuration"), "The deployment's");
  if (typeof settings === "string") return settings;
  const missing = CONFIG_FIELDS.find((f) => !(f.key in settings));
  if (missing) return `Choose the ${missing.label.toLowerCase()}.`;
  const { cooling, networking, storageTbPerNode, ...rest } = settings as unknown as ColumnConfig & DeploymentConfig;
  const configuration = { ...DEFAULT_CONFIG };
  for (const key of Object.keys(DEFAULT_CONFIG) as (keyof DeploymentConfig)[]) {
    (configuration as Record<string, unknown>)[key] = rest[key];
  }
  return {
    cooling: SYSTEMS[platform].rackScale ? "liquid_dtc" : cooling,
    networking,
    storageTbPerNode,
    configuration,
  };
}

/** The rollout, one phase per row of `phase_*` fields in order; blank rows are skipped. */
function readPhases(formData: FormData): PhaseInput[] | string {
  const ids = formData.getAll("phase_id");
  const names = formData.getAll("phase_name");
  const platforms = formData.getAll("phase_platform");
  const starts = formData.getAll("phase_start_on");
  const rfs = formData.getAll("phase_rfs_on");
  const nodes = formData.getAll("phase_nodes");
  const mws = formData.getAll("phase_mw");
  const overrides = formData.getAll("phase_config");
  const prices = formData.getAll("phase_price_gpu_hr");
  const phaseTerms = formData.getAll("phase_term_months");
  const deposits = formData.getAll("phase_deposit_pct");
  const phases: PhaseInput[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < rfs.length; i++) {
    const row = {
      name: text(names[i]),
      startOn: text(starts[i]),
      rfsOn: text(rfs[i]),
      nodes: text(nodes[i]),
      mw: text(mws[i]),
      price: text(prices[i]),
      term: text(phaseTerms[i]),
      deposit: text(deposits[i]),
    };
    if (Object.values(row).every((value) => !value)) continue;
    const label = row.name || `Phase ${phases.length + 1}`;
    if (row.name.length > MAX_TEXT) return `${label}'s name is too long.`;
    const phasePlatform = text(platforms[i]);
    if (!isOption(PLATFORM_OPTIONS, phasePlatform)) return `Choose ${label}'s platform.`;
    if (!isDay(row.rfsOn)) return `${label} needs an RFS date.`;
    if (row.startOn && !isDay(row.startOn)) return `${label}'s start must be a date.`;
    if (row.startOn && row.startOn > row.rfsOn) return `${label} must start on or before its RFS date.`;
    const phaseNodes = figure(row.nodes, `${label}'s nodes`, 1e6, true);
    if (typeof phaseNodes === "string") return phaseNodes;
    if (phaseNodes === null) return `${label} needs a node count.`;
    const mw = figure(row.mw, `${label}'s MW`, 1e6);
    if (typeof mw === "string") return mw;
    const configOverrides = readSettings(overrides[i], `${label}'s`);
    if (typeof configOverrides === "string") return configOverrides;
    const pricing = readTerms(row.price, row.term, row.deposit, `${label}'s `);
    if (typeof pricing === "string") return pricing;
    const id = text(ids[i]);
    if (id && (!isUuid(id) || seen.has(id))) return `${label} no longer exists. Reload and try again.`;
    if (id) seen.add(id);
    phases.push({
      id: id || null,
      name: row.name || null,
      platform: phasePlatform,
      startOn: row.startOn || null,
      rfsOn: row.rfsOn,
      nodes: phaseNodes,
      mw,
      configOverrides: configOverrides as ConfigOverrides,
      ...pricing,
    });
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
  if (!isOption(STATUSES, status)) return "Choose a status.";

  // Platform and nodes follow the phases: the first phase's platform, and the nodes they all schedule.
  const phases = readPhases(formData);
  if (typeof phases === "string") return phases;
  if (!phases.length) return "Add a phase with its RFS date and nodes.";
  const platform = phases[0].platform;
  const nodes = phases.reduce((sum, phase) => sum + phase.nodes, 0);
  if (!nodes) return "Give the phases their nodes.";
  const config = readConfig(formData, platform);
  if (typeof config === "string") return config;
  const { cooling, networking, storageTbPerNode, configuration } = config;

  const facility = field("facility");
  if (facility && !isOption(FACILITIES, facility)) return "Choose the facility type.";
  const creditRating = field("credit_rating");
  if (creditRating && !isOption(CREDIT_RATINGS, creditRating)) return "Choose the credit requirement.";

  const address = field("address");
  if (address.length > MAX_ADDRESS) return "The address is too long.";
  const placeId = address ? field("place_id") : "";
  if (placeId && !isPlaceId(placeId)) return "Pick the address from the list again.";
  const city = placeId ? field("city") : "";
  if (city.length > MAX_TEXT) return "The city is too long.";
  const notesOf = (key: string): string => {
    const raw = formData.get(key);
    return typeof raw === "string" ? multiLine(raw) : "";
  };
  const notes = notesOf("notes");
  if (notes.length > MAX_NOTES) return "The internal notes are too long.";
  const externalNotes = notesOf("external_notes");
  if (externalNotes.length > MAX_NOTES) return "The external notes are too long.";

  const locRequired = field("loc_required") === "yes";
  const locYears = locRequired ? figure(field("loc_years"), "The LOC's years of lease", 100) : null;
  if (typeof locYears === "string") return locYears;
  if (locYears === 0) return "The LOC must cover some of the lease.";
  if (typeof locYears === "number" && Math.abs(Math.round(locYears * 100) - locYears * 100) > 1e-6) {
    return "Give the LOC's years of lease to at most two decimals.";
  }

  // Terms are set by phase; the deployment's own are cleared, so none fall back on them.
  const termMonths = null;
  const priceGpuHr = null;
  const depositPct = null;
  const { depositUsd } = totalsOf({ nodes, platform, storageTbPerNode, priceGpuHr, termMonths, depositPct, phases });

  return {
    name,
    status,
    nodes,
    platform,
    cooling,
    networking,
    storageTbPerNode,
    configuration,
    address: address || null,
    city: city || null,
    placeId: placeId || null,
    facility: facility ? (facility as DeploymentInput["facility"]) : null,
    termMonths,
    priceGpuHr,
    depositPct,
    depositUsd,
    creditRating: creditRating ? (creditRating as DeploymentInput["creditRating"]) : null,
    locRequired,
    locYears: locYears as number | null,
    creditGuarantee: field("credit_guarantee") === "yes",
    leaseGuarantee: field("lease_guarantee") === "yes",
    notes: notes || null,
    externalNotes: externalNotes || null,
    dataRoomId: field("data_room_id") || null,
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
  if (rawId && !(await getDeploymentFor(rawId, { team: true, userId: account.userId }))) {
    return { error: "This deployment no longer exists." };
  }

  const input = readDeployment(formData);
  if (typeof input === "string") return { error: input };
  if (input.dataRoomId && !(await roomExists(input.dataRoomId))) {
    return { error: "That data room no longer exists. Pick another." };
  }

  const id = await saveDeployment(rawId || null, input, await userIdFor(account.userId));
  if (!id) return { error: "This deployment was deleted. Reload to see the current list." };

  updateTag(DEPLOYMENTS_TAG);
  redirect(`/portal/deployments/${id}`);
}

/** Deletes a deployment and its phases, then opens the list. The ZODE team only. */
export async function deleteDeploymentAction(id: string): Promise<DeploymentFormState> {
  const account = await teamAccount();
  if (!account) return { error: "You don't have access to this. Try reloading the page." };
  if (!(await getDeploymentFor(id, { team: true, userId: account.userId }))) {
    return { error: "This deployment no longer exists." };
  }
  await deleteDeployment(id);
  await deleteBlobsUnder(quoteBlobPrefix(id));
  updateTag(DEPLOYMENTS_TAG);
  redirect("/portal/deployments");
}

export type ShareResult = { access: DeploymentAccess; token: string | null } | { error: string };

/**
 * Sets who can open deployment `id` (see `ACCESS_OPTIONS`); "Only me" makes
 * it the signed-in account's alone. The ZODE team only.
 */
export async function setDeploymentAccessAction(id: string, access: DeploymentAccess): Promise<ShareResult> {
  const account = await teamAccount();
  if (!account) return { error: "You don't have access to this. Try reloading the page." };
  if (!ACCESS_OPTIONS.some((option) => option.value === access)) return { error: "Pick who can open it." };
  const saved = await setAccess(id, access, account.userId, newShareToken());
  if (!saved) return { error: "This deployment was deleted. Reload to see the current list." };
  updateTag(DEPLOYMENTS_TAG);
  return saved;
}
