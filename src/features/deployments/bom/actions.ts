"use server";

import { updateTag } from "next/cache";
import { isSlotId } from "@/features/cluster/model/slots";
import { configFromJson } from "@/features/cluster/model/url";
import { listFileNames } from "@/features/data-room/rooms";
import { isUuid, teamAccount } from "@/features/zrm/access";
import { multiLine, singleLine } from "@/lib/validation";
import { DEPLOYMENTS_TAG, getDeploymentFor } from "../deployments";
import { BOM_TAG, foreignQuoteIds, saveBom, savePhaseCluster, type BomInput, type QuoteInput } from "./bom";
import type { BomFill, BomItem } from "./types";

export type BomResult = { error?: string };

const MAX_QUOTES = 40;
const MAX_ITEMS = 3_000;
const MAX_FILLS = 8;
const MAX_TEXT = 300;
const MAX_LONG = 2_000;
const MAX_COPIES = 64;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const NO_ACCESS = { error: "You don't have access to this. Try reloading the page." };
const GONE = { error: "This deployment no longer exists." };

/** A trimmed single line up to `max`, null when blank; a string past `max` is an error, thrown. */
function line(value: unknown, label: string, max = MAX_TEXT): string | null {
  if (value == null) return null;
  if (typeof value !== "string") throw new Error(`${label} must be text.`);
  const cleaned = singleLine(value);
  if (cleaned.length > max) throw new Error(`${label} is too long.`);
  return cleaned || null;
}

function amount(value: unknown, label: string, { nullable = true, max = 1e12 } = {}): number | null {
  if (value == null || value === "") {
    if (nullable) return null;
    throw new Error(`${label} is required.`);
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value >= max) {
    throw new Error(`${label} must be a number of at least zero.`);
  }
  return value;
}

function day(value: unknown, label: string): string | null {
  const text = line(value, label, 10);
  if (text && (!DAY_RE.test(text) || Number.isNaN(Date.parse(text)))) throw new Error(`${label} must be a date.`);
  return text;
}

function readQuote(raw: unknown, i: number, files: ReadonlySet<string>): QuoteInput {
  const q = (raw ?? {}) as Record<string, unknown>;
  const label = `Quote ${i + 1}`;
  if (typeof q.id !== "string" || !isUuid(q.id)) throw new Error(`${label} is malformed. Reload and try again.`);
  const vendor = line(q.vendor, `${label}'s vendor`);
  if (!vendor) throw new Error(`${label} needs a vendor.`);
  const fileId = line(q.dataRoomFileId, `${label}'s file`, 36);
  if (fileId && !files.has(fileId)) throw new Error(`${vendor}'s file isn't in the deployment's data room.`);
  const notes = typeof q.notes === "string" ? multiLine(q.notes) : null;
  if (notes && notes.length > MAX_LONG) throw new Error(`${vendor}'s notes are too long.`);
  return {
    id: q.id,
    vendor,
    reference: line(q.reference, `${vendor}'s reference`),
    quotedOn: day(q.quotedOn, `${vendor}'s quote date`),
    validUntil: day(q.validUntil, `${vendor}'s expiry`),
    quotedTotalUsd: amount(q.quotedTotalUsd, `${vendor}'s stated total`),
    dataRoomFileId: fileId,
    notes: notes || null,
  };
}

function readItem(raw: unknown, i: number, phases: ReadonlySet<string>, quotes: ReadonlySet<string>): Omit<BomItem, "id"> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const label = `Line ${i + 1}`;
  const description = line(r.description, `${label}'s description`, MAX_LONG);
  if (!description) throw new Error(`${label} needs a description.`);
  const phaseId = line(r.phaseId, `${label}'s phase`, 36);
  if (phaseId && !phases.has(phaseId)) throw new Error(`${label}'s phase no longer exists.`);
  const quoteId = line(r.quoteId, `${label}'s quote`, 36);
  if (quoteId && !quotes.has(quoteId)) throw new Error(`${label}'s quote isn't in this BOM.`);
  const status = r.status === "excluded" ? "excluded" : "use";
  const fillsRaw = Array.isArray(r.fills) ? r.fills : [];
  if (fillsRaw.length > MAX_FILLS) throw new Error(`${label} fills too many slots.`);
  const fills: BomFill[] = [];
  for (const f of fillsRaw as Record<string, unknown>[]) {
    if (typeof f?.slotId !== "string" || !isSlotId(f.slotId)) throw new Error(`${label} fills a slot that doesn't exist.`);
    if (fills.some((fill) => fill.slotId === f.slotId)) throw new Error(`${label} fills the same slot twice.`);
    const units = amount(f.unitsPerItem, `${label}'s units per item`, { nullable: false, max: 1e6 })!;
    if (units <= 0) throw new Error(`${label}'s units per item must be more than zero.`);
    fills.push({ slotId: f.slotId, unitsPerItem: units });
  }
  return {
    phaseId,
    quoteId,
    quoteSection: line(r.quoteSection, `${label}'s section`) ?? "",
    partNumber: line(r.partNumber, `${label}'s part number`),
    description,
    quantity: amount(r.quantity, `${label}'s quantity`, { nullable: false, max: 1e9 })!,
    quotedQuantity: amount(r.quotedQuantity, `${label}'s quoted quantity`, { max: 1e9 }),
    unitUsd: amount(r.unitUsd, `${label}'s unit price`),
    status,
    excludedReason: status === "excluded" ? line(r.excludedReason, `${label}'s reason`, MAX_LONG) : null,
    leadTime: line(r.leadTime, `${label}'s lead time`),
    notes: line(r.notes, `${label}'s notes`, MAX_LONG),
    fills: status === "excluded" ? [] : fills,
  };
}

/** Saves deployment `deploymentId`'s whole BOM. The ZODE team only. */
export async function saveBomAction(deploymentId: string, payload: unknown): Promise<BomResult> {
  const account = await teamAccount();
  if (!account) return NO_ACCESS;
  if (!isUuid(deploymentId)) return GONE;
  const deployment = await getDeploymentFor(deploymentId, { team: true, userId: account.userId });
  if (!deployment) return GONE;

  const body = (payload ?? {}) as Record<string, unknown>;
  const rawQuotes = Array.isArray(body.quotes) ? body.quotes : [];
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawQuotes.length > MAX_QUOTES) return { error: `A BOM can have at most ${MAX_QUOTES} quotes.` };
  if (rawItems.length > MAX_ITEMS) return { error: `A BOM can have at most ${MAX_ITEMS} lines.` };

  const files = new Set(
    deployment.dataRoomId ? (await listFileNames(deployment.dataRoomId)).map((file) => file.id) : [],
  );
  const phases = new Set(deployment.phases.map((phase) => phase.id));
  let input: BomInput;
  try {
    const quotes = rawQuotes.map((raw, i) => readQuote(raw, i, files));
    const ids = new Set(quotes.map((quote) => quote.id));
    if (ids.size !== quotes.length) throw new Error("Two quotes share an id. Reload and try again.");
    input = { quotes, items: rawItems.map((raw, i) => readItem(raw, i, phases, ids)) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The BOM couldn't be read." };
  }
  if ((await foreignQuoteIds(deploymentId, input.quotes.map((quote) => quote.id))).length) {
    return { error: "A quote belongs to another deployment. Reload and try again." };
  }

  await saveBom(deploymentId, input);
  updateTag(BOM_TAG);
  return {};
}

/** Saves the cluster-builder config phase `phaseId` is checked against, or derives it again with null. */
export async function savePhaseClusterAction(
  deploymentId: string,
  phaseId: string,
  config: unknown,
  copies: unknown,
): Promise<BomResult> {
  const account = await teamAccount();
  if (!account) return NO_ACCESS;
  if (!isUuid(deploymentId) || !isUuid(phaseId)) return GONE;
  if (!(await getDeploymentFor(deploymentId, { team: true, userId: account.userId }))) return GONE;
  const parsed = config === null ? null : configFromJson(config);
  if (config !== null && !parsed) return { error: "That isn't a configuration the cluster builder offers." };
  if (typeof copies !== "number" || !Number.isInteger(copies) || copies < 1 || copies > MAX_COPIES) {
    return { error: `Copies must be a whole number from 1 to ${MAX_COPIES}.` };
  }
  if (!(await savePhaseCluster(deploymentId, phaseId, parsed, copies))) {
    return { error: "This phase no longer exists. Reload to see the deployment." };
  }
  updateTag(DEPLOYMENTS_TAG);
  return {};
}
