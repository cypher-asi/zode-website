import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";

/** A conversion the team tracks: an event by name, or a pageview whose path matches, `*` matching anything. */
export interface Goal {
  id: number;
  label: string;
  matchKind: "event" | "path";
  match: string;
}

/** Tagged on every cached report that counts conversions, so adding or removing a goal shows at once. */
export const GOALS_TAG = "analytics:goals";

export const listGoals = cache(async (): Promise<Goal[]> => {
  const rows = await db()`select id, label, match_kind, match from analytics_goals order by label`;
  return rows.map((row) => ({
    id: Number(row.id),
    label: String(row.label),
    matchKind: row.match_kind === "path" ? "path" : "event",
    match: String(row.match),
  }));
});

/** Adds a goal, or relabels the one that already matches the same thing. */
export async function saveGoal(goal: Omit<Goal, "id">, zosUserId: string): Promise<void> {
  await db()`
    insert into analytics_goals (label, match_kind, match, created_by)
    values (${goal.label}, ${goal.matchKind}, ${goal.match}, (select id from users where zos_user_id = ${zosUserId}))
    on conflict (match_kind, match) do update set label = excluded.label
  `;
}

export async function deleteGoal(id: number): Promise<void> {
  await db()`delete from analytics_goals where id = ${id}`;
}
