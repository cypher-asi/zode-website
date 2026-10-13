"use server";

import { refresh } from "next/cache";
import { isUuid, teamAccount } from "@/features/zrm/access";
import { setLeadStatus } from "./leads";
import { isLeadSource, isLeadStatus, type LeadStatusResult } from "./types";

/** Sets where the team stands with a lead: New, Contacted, Qualified or Closed. ZODE team only. */
export async function setLeadStatusAction(source: unknown, id: unknown, status: unknown): Promise<LeadStatusResult> {
  if (!(await teamAccount())) return { error: "You don't have permission to do that. Try reloading the page." };
  if (!isLeadSource(source) || !isUuid(id) || !isLeadStatus(status)) return { error: "That isn't a valid change." };

  try {
    if (!(await setLeadStatus(source, id, status))) return { error: "That lead no longer exists." };
  } catch (error) {
    console.error("[leads] couldn't set status", source, id, status, error);
    return { error: "Couldn't save right now. Please try again." };
  }
  refresh();
  return {};
}
