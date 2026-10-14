"use server";

import { refresh, updateTag } from "next/cache";
import { teamAccount } from "@/features/zrm/access";
import { singleLine } from "@/lib/validation";
import { isAnalyticsEvent } from "./events";
import { deleteGoal, GOALS_TAG, saveGoal } from "./goals";

export interface GoalFormState {
  readonly error?: string;
  readonly ok?: boolean;
}

const NO_ACCESS = "You don't have permission to do that. Try reloading the page.";

/** Adds a goal for an event from events.ts, or for pageviews whose path matches a pattern like /news/*. */
export async function saveGoalAction(_prev: GoalFormState, formData: FormData): Promise<GoalFormState> {
  const account = await teamAccount();
  if (!account) return { error: NO_ACCESS };

  const matchKind = formData.get("matchKind") === "path" ? "path" : "event";
  const match = singleLine(String(formData.get("match") ?? "")).trim();
  const label = singleLine(String(formData.get("label") ?? "")).trim();
  if (!label) return { error: "Give the goal a name." };
  if (label.length > 80) return { error: "That name is too long." };
  if (matchKind === "event" && !isAnalyticsEvent(match)) return { error: "Pick an event." };
  if (matchKind === "path" && (!match.startsWith("/") || match.length > 200)) {
    return { error: "A path starts with /, e.g. /buy-compute or /news/*." };
  }

  try {
    await saveGoal({ label, matchKind, match }, account.userId);
  } catch (error) {
    console.error("[analytics] couldn't save goal", error);
    return { error: "Couldn't save the goal right now. Please try again." };
  }
  updateTag(GOALS_TAG);
  refresh();
  return { ok: true };
}

export async function deleteGoalAction(id: number): Promise<{ error?: string }> {
  if (!(await teamAccount())) return { error: NO_ACCESS };
  if (!Number.isInteger(id)) return { error: "That goal doesn't exist." };
  try {
    await deleteGoal(id);
  } catch (error) {
    console.error("[analytics] couldn't delete goal", error);
    return { error: "Couldn't remove the goal right now. Please try again." };
  }
  updateTag(GOALS_TAG);
  refresh();
  return {};
}
