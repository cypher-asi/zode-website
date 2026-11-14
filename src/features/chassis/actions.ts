"use server";

import { refresh, updateTag } from "next/cache";
import { BOM_TAG } from "@/features/deployments/bom/bom";
import { getDeploymentFor } from "@/features/deployments/deployments";
import { userIdFor } from "@/features/users/users";
import { isUuid, teamAccount } from "@/features/zrm/access";
import { multiLine, singleLine } from "@/lib/validation";
import {
  CHASSIS_TAG,
  createDesign,
  renameDesign,
  saveVersion,
  sendToDeployment,
  setArchived,
  versionData,
} from "./designs";
import { safeParseDesign, seedDesign } from "./model/seed";
import type { ActionResult } from "./types";

const MAX_NAME = 120;
const MAX_NOTE = 2_000;
const MAX_SETS = 1_000;

const NO_ACCESS = { error: "You don't have access to this. Try reloading the page." };
const GONE = { error: "This design no longer exists. Reload to see the designs." };
const INVALID = { error: "The design's data isn't valid. Undo the last edit, or export it to check." };

const nameOf = (value: unknown): string | null => {
  const name = typeof value === "string" ? singleLine(value) : "";
  return name && name.length <= MAX_NAME ? name : null;
};

const noteOf = (value: unknown): string | null => {
  const note = typeof value === "string" ? multiLine(value).slice(0, MAX_NOTE) : "";
  return note || null;
};

async function teamUser(): Promise<{ userId: number | null; zosUserId: string } | null> {
  const account = await teamAccount();
  return account ? { userId: await userIdFor(account.userId), zosUserId: account.userId } : null;
}

/**
 * A new design: NIRA Chassis I as issued, or a copy of design `fromId` at
 * `fromVersion`. Resolves with its id.
 */
export async function createDesignAction(
  rawName: string,
  from: { id: string; version: number } | null,
): Promise<ActionResult<{ id: string }>> {
  const user = await teamUser();
  if (!user) return NO_ACCESS;
  const name = nameOf(rawName);
  if (!name) return { error: `Give the design a name of up to ${MAX_NAME} characters.` };
  let data = seedDesign;
  let note = "Started from NIRA Chassis I as issued.";
  if (from) {
    if (!isUuid(from.id) || !Number.isInteger(from.version)) return GONE;
    const source = await versionData(from.id, from.version);
    if (!source) return GONE;
    data = source.data;
    note = `Copied from ${source.name}, version ${from.version}.`;
  }
  const id = await createDesign(name, data, user.userId, note);
  updateTag(CHASSIS_TAG);
  return { id };
}

/**
 * Saves the edited data as design `id`'s next version. Rejected when someone
 * saved since `baseVersion`, unless `force`, with the latest version so the
 * editor can offer to save over it.
 */
export async function saveDesignAction(
  id: string,
  baseVersion: number,
  rawData: unknown,
  rawNote: string,
  force = false,
): Promise<ActionResult<{ version: number; latest?: number }>> {
  const user = await teamUser();
  if (!user) return NO_ACCESS;
  if (!isUuid(id) || !Number.isInteger(baseVersion)) return GONE;
  const data = safeParseDesign(rawData);
  if (!data) return INVALID;
  let outcome;
  try {
    outcome = await saveVersion(id, baseVersion, data, noteOf(rawNote), user.userId, force);
  } catch {
    return { error: "Someone saved this design at the same moment. Try saving again." };
  }
  if (!outcome) return GONE;
  if ("conflict" in outcome) {
    return {
      error: `Version ${outcome.conflict} was saved while you were editing. Discard your edits to see it, or save over it.`,
      latest: outcome.conflict,
    };
  }
  updateTag(CHASSIS_TAG);
  return { version: outcome.version };
}

/** Design `id`'s data at `version`, to open in the editor as a draft over the latest. */
export async function versionDataAction(id: string, version: number): Promise<ActionResult<{ data: unknown }>> {
  const user = await teamUser();
  if (!user) return NO_ACCESS;
  if (!isUuid(id) || !Number.isInteger(version)) return GONE;
  const found = await versionData(id, version);
  return found ? { data: found.data } : GONE;
}

export async function renameDesignAction(id: string, rawName: string): Promise<ActionResult> {
  const user = await teamUser();
  if (!user) return NO_ACCESS;
  const name = nameOf(rawName);
  if (!name) return { error: `Give the design a name of up to ${MAX_NAME} characters.` };
  if (!isUuid(id) || !(await renameDesign(id, name, user.userId))) return GONE;
  updateTag(CHASSIS_TAG);
  refresh();
  return {};
}

export async function archiveDesignAction(id: string, archived: boolean): Promise<ActionResult> {
  const user = await teamUser();
  if (!user) return NO_ACCESS;
  if (!isUuid(id) || !(await setArchived(id, archived))) return GONE;
  updateTag(CHASSIS_TAG);
  return {};
}

/**
 * Writes design `designId` at `version` into a deployment as its chassis
 * quote, and onto `phaseId`'s BOM at `sets` sets of pods when given one.
 * Resolves with the quote's id, for the drawing set to be attached to it.
 */
export async function sendToDeploymentAction(input: {
  designId: string;
  version: number;
  deploymentId: string;
  phaseId: string | null;
  sets: number;
}): Promise<ActionResult<{ quoteId: string }>> {
  const user = await teamUser();
  if (!user) return NO_ACCESS;
  const { designId, version, deploymentId, phaseId, sets } = input;
  if (!isUuid(designId) || !Number.isInteger(version)) return GONE;
  if (!isUuid(deploymentId) || !(await getDeploymentFor(deploymentId, { team: true, userId: user.zosUserId }))) {
    return { error: "That deployment no longer exists. Reload to see the deployments." };
  }
  if (phaseId !== null && !isUuid(phaseId)) return { error: "Pick one of the deployment's phases." };
  if (!Number.isInteger(sets) || sets < 1 || sets > MAX_SETS) {
    return { error: `Sets of pods must be a whole number from 1 to ${MAX_SETS}.` };
  }
  const quoteId = await sendToDeployment({ designId, version, deploymentId, phaseId, sets });
  if (!quoteId) return { error: "That design version or phase no longer exists. Reload and try again." };
  updateTag(BOM_TAG);
  updateTag(CHASSIS_TAG);
  return { quoteId };
}
