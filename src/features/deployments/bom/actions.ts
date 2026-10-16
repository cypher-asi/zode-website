"use server";

import { refresh, updateTag } from "next/cache";
import { isSlotId, slotById } from "@/features/cluster/model/slots";
import { configFromJson } from "@/features/cluster/model/url";
import { blobInfo, deleteBlobs } from "@/features/data-room/blob";
import { listFileNames } from "@/features/data-room/rooms";
import { isUuid, teamAccount } from "@/features/zrm/access";
import { multiLine, singleLine } from "@/lib/validation";
import { DEPLOYMENTS_TAG, getDeploymentFor } from "../deployments";
import type { Deployment } from "../types";
import {
  BOM_TAG,
  createQuote,
  deleteQuote,
  foreignItemIds,
  getBom,
  quoteBlobPrefix,
  renameQuote,
  saveBomLines,
  savePhaseCluster,
  saveQuote,
  setQuoteFile,
  type BomLineInput,
  type QuoteInput,
  type StoredQuoteFile,
} from "./bom";
import type { QuoteItem } from "./types";

export type BomResult = { error?: string; id?: string };

const MAX_ITEMS = 3_000;
const MAX_LINES = 3_000;
const MAX_TEXT = 300;
const MAX_LONG = 2_000;
const MAX_COPIES = 64;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const NO_ACCESS = { error: "You don't have access to this. Try reloading the page." };
const GONE = { error: "This deployment no longer exists." };
const QUOTE_GONE = { error: "This quote no longer exists. Reload to see the deployment's quotes." };

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

function readQuote(raw: unknown, files: ReadonlySet<string>): QuoteInput {
  const q = (raw ?? {}) as Record<string, unknown>;
  const label = "The quote";
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

function readItem(raw: unknown, i: number, quotes: ReadonlyMap<string, string>): QuoteItem {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (typeof r.id !== "string" || !isUuid(r.id)) throw new Error(`Quote item ${i + 1} is malformed. Reload and try again.`);
  const quoteId = line(r.quoteId, `Quote item ${i + 1}'s quote`, 36);
  const vendor = quoteId ? quotes.get(quoteId) : undefined;
  if (!quoteId || vendor === undefined) throw new Error(`Quote item ${i + 1}'s quote isn't in this BOM.`);
  const label = `${vendor || "A quote"}'s item ${line(r.partNumber, "Part number") ?? i + 1}`;
  const description = line(r.description, `${label}'s description`, MAX_LONG);
  if (!description) throw new Error(`${label} needs a description.`);
  return {
    id: r.id,
    quoteId,
    section: line(r.section, `${label}'s section`) ?? "",
    partNumber: line(r.partNumber, `${label}'s part number`),
    manufacturer: line(r.manufacturer, `${label}'s manufacturer`),
    description,
    quantity: amount(r.quantity, `${label}'s quantity`, { max: 1e9 }),
    unitUsd: amount(r.unitUsd, `${label}'s unit price`),
    leadTime: line(r.leadTime, `${label}'s lead time`),
    notes: line(r.notes, `${label}'s notes`, MAX_LONG),
  };
}

function readLine(raw: unknown, i: number, phases: ReadonlySet<string>, items: ReadonlySet<string>): BomLineInput {
  const r = (raw ?? {}) as Record<string, unknown>;
  const slotId = line(r.slotId, `Line ${i + 1}'s slot`, 60);
  if (slotId && !isSlotId(slotId)) throw new Error(`Line ${i + 1} is in a slot that doesn't exist.`);
  const label = `The ${slotId ? (slotById(slotId)?.label ?? "slot") : "other"} line ${line(r.partNumber, "Part number") ?? i + 1}`;
  const phaseId = line(r.phaseId, `${label}'s phase`, 36);
  if (!phaseId || !phases.has(phaseId)) throw new Error(`${label}'s phase no longer exists.`);
  const quoteItemId = line(r.quoteItemId, `${label}'s quote item`, 36);
  const description = line(r.description, `${label}'s description`, MAX_LONG);
  if (!description) throw new Error(`${label} needs a description: pick a quote item or type one.`);
  return {
    phaseId,
    slotId,
    quoteItemId: quoteItemId && items.has(quoteItemId) ? quoteItemId : null,
    partNumber: line(r.partNumber, `${label}'s part number`),
    manufacturer: line(r.manufacturer, `${label}'s manufacturer`),
    description,
    quantity: amount(r.quantity, `${label}'s quantity`, { nullable: false, max: 1e9 })!,
    unitUsd: amount(r.unitUsd, `${label}'s unit price`),
    notes: line(r.notes, `${label}'s notes`, MAX_LONG),
  };
}

/** The deployment, when the signed-in account is on the ZODE team and it exists; else the result to send back. */
async function teamDeployment(
  deploymentId: unknown,
): Promise<{ deployment: Deployment; failed?: never } | { failed: BomResult; deployment?: never }> {
  const account = await teamAccount();
  if (!account) return { failed: NO_ACCESS };
  if (!isUuid(deploymentId)) return { failed: GONE };
  const deployment = await getDeploymentFor(deploymentId, { team: true, userId: account.userId });
  return deployment ? { deployment } : { failed: GONE };
}

const done = (result: BomResult = {}): BomResult => {
  updateTag(BOM_TAG);
  refresh();
  return result;
};

/** Saves deployment `deploymentId`'s BOM lines, every phase's. The ZODE team only. */
export async function saveBomLinesAction(deploymentId: string, payload: unknown): Promise<BomResult> {
  const found = await teamDeployment(deploymentId);
  if (found.failed) return found.failed;
  const { deployment } = found;
  const raw = Array.isArray(payload) ? payload : [];
  if (raw.length > MAX_LINES) return { error: `A BOM can have at most ${MAX_LINES} lines.` };

  const phases = new Set(deployment.phases.map((phase) => phase.id));
  const items = new Set((await getBom(deployment.id)).items.map((item) => item.id));
  let lines: BomLineInput[];
  try {
    lines = raw.map((line, i) => readLine(line, i, phases, items));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The BOM couldn't be read." };
  }
  await saveBomLines(deployment.id, lines);
  updateTag(BOM_TAG);
  return {};
}

/** Saves one quote's details and its whole price list. The ZODE team only. */
export async function saveQuoteAction(deploymentId: string, payload: unknown): Promise<BomResult> {
  const found = await teamDeployment(deploymentId);
  if (found.failed) return found.failed;
  const { deployment } = found;
  const body = (payload ?? {}) as Record<string, unknown>;
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length > MAX_ITEMS) return { error: `A quote can have at most ${MAX_ITEMS} items.` };

  const files = new Set(
    deployment.dataRoomId ? (await listFileNames(deployment.dataRoomId)).map((file) => file.id) : [],
  );
  let quote: QuoteInput;
  let items: QuoteItem[];
  try {
    quote = readQuote(body.quote, files);
    const vendors = new Map([[quote.id, quote.vendor]]);
    items = rawItems.map((raw, i) => readItem({ ...(raw as object), quoteId: quote.id }, i, vendors));
    if (new Set(items.map((item) => item.id)).size !== items.length) {
      throw new Error("Two items share an id. Reload and try again.");
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The quote couldn't be read." };
  }
  if ((await foreignItemIds(deployment.id, items.map((item) => item.id))).length) {
    return { error: "An item belongs to another deployment. Reload and try again." };
  }
  if (!(await saveQuote(deployment.id, quote, items))) return QUOTE_GONE;
  return done();
}

/** A blank quote to type in, for one with no file. Resolves with its id. */
export async function addQuoteAction(deploymentId: string): Promise<BomResult> {
  const found = await teamDeployment(deploymentId);
  if (found.failed) return found.failed;
  const id = await createQuote(found.deployment.id, "New quote", null);
  return id ? done({ id }) : GONE;
}

/** The uploaded blob at `pathname`, when it's under the deployment's quote prefix and finished uploading. */
async function storedFile(deploymentId: string, pathname: unknown, rawName: unknown): Promise<StoredQuoteFile | BomResult> {
  if (typeof pathname !== "string" || !pathname.startsWith(quoteBlobPrefix(deploymentId)) || pathname.includes("..")) {
    return { error: "That upload doesn't belong to this deployment." };
  }
  const name = typeof rawName === "string" ? singleLine(rawName).slice(0, 255) : "";
  if (!name) return { error: "The file needs a name." };
  const info = await blobInfo(pathname);
  if (!info) return { error: "The upload didn't finish. Try again." };
  return { pathname, name, contentType: info.contentType || "application/octet-stream", sizeBytes: info.size };
}

/**
 * Records an uploaded file as quote `quoteId`'s, replacing any it had, or as
 * a new quote named after the file when `quoteId` is null. Resolves with the
 * quote's id.
 */
export async function attachQuoteFileAction(
  deploymentId: string,
  quoteId: string | null,
  pathname: string,
  rawName: string,
): Promise<BomResult> {
  const found = await teamDeployment(deploymentId);
  if (found.failed) return found.failed;
  const id = found.deployment.id;
  const file = await storedFile(id, pathname, rawName);
  if (!("pathname" in file)) return file;

  if (quoteId === null) {
    const vendor = file.name.replace(/\.[^.]+$/, "").slice(0, MAX_TEXT) || file.name;
    const created = await createQuote(id, vendor, file);
    if (!created) {
      await deleteBlobs([file.pathname]);
      return GONE;
    }
    return done({ id: created });
  }
  if (!isUuid(quoteId)) return QUOTE_GONE;
  const previous = await setQuoteFile(id, quoteId, file);
  if (previous === undefined) {
    await deleteBlobs([file.pathname]);
    return QUOTE_GONE;
  }
  if (previous && previous !== file.pathname) await deleteBlobs([previous]);
  return done({ id: quoteId });
}

/** Takes the quote's uploaded file off it and deletes it; a linked data room file is unlinked. */
export async function removeQuoteFileAction(deploymentId: string, quoteId: string): Promise<BomResult> {
  const found = await teamDeployment(deploymentId);
  if (found.failed) return found.failed;
  if (!isUuid(quoteId)) return QUOTE_GONE;
  const bom = await getBom(found.deployment.id);
  const quote = bom.quotes.find((q) => q.id === quoteId);
  if (!quote) return QUOTE_GONE;
  if (quote.file?.source === "data-room") {
    const items = bom.items.filter((item) => item.quoteId === quoteId);
    await saveQuote(found.deployment.id, { ...quote, dataRoomFileId: null }, items);
    return done();
  }
  const previous = await setQuoteFile(found.deployment.id, quoteId, null);
  if (previous === undefined) return QUOTE_GONE;
  if (previous) await deleteBlobs([previous]);
  return done();
}

export async function renameQuoteAction(deploymentId: string, quoteId: string, rawVendor: string): Promise<BomResult> {
  const found = await teamDeployment(deploymentId);
  if (found.failed) return found.failed;
  const vendor = typeof rawVendor === "string" ? singleLine(rawVendor) : "";
  if (!vendor) return { error: "Enter the vendor's name." };
  if (vendor.length > MAX_TEXT) return { error: "That name is too long." };
  if (!isUuid(quoteId) || !(await renameQuote(found.deployment.id, quoteId, vendor))) return QUOTE_GONE;
  return done();
}

/** Deletes the quote, its price list and its uploaded file; BOM lines picked from it keep what they copied. */
export async function deleteQuoteAction(deploymentId: string, quoteId: string): Promise<BomResult> {
  const found = await teamDeployment(deploymentId);
  if (found.failed) return found.failed;
  if (!isUuid(quoteId)) return QUOTE_GONE;
  const pathname = await deleteQuote(found.deployment.id, quoteId);
  if (pathname === undefined) return QUOTE_GONE;
  if (pathname) await deleteBlobs([pathname]);
  return done();
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
