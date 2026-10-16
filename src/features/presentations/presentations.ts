import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { isUuid } from "@/features/zrm/access";
import { DB_TAG, db } from "@/lib/db";
import { EMPTY_CONTENT, type Presentation, type PresentationContent, type PresentationInput } from "./types";

/** Every presentation read is cached under this tag, which saving and deleting update. */
export const PRESENTATIONS_TAG = "presentations";

const toPresentation = (row: Record<string, unknown>): Presentation => ({
  ...EMPTY_CONTENT,
  ...(row.content as Partial<PresentationContent>),
  id: String(row.id),
  deploymentId: String(row.deployment_id),
  deploymentName: String(row.deployment_name),
  updatedAt: new Date(row.updated_at as string | Date).toISOString(),
});

/** Every deployment's presentation. The same for whoever asks, so cached on the server; callers check the deployment's access. */
async function listPresentations(): Promise<Presentation[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(PRESENTATIONS_TAG, DB_TAG);
  const rows = await db()`
    select p.*, d.name as deployment_name
    from deployment_presentations p
    join deployments d on d.id = p.deployment_id
  `;
  return rows.map(toPresentation);
}

/** Deployment `deploymentId`'s presentation, if it has one. Check the viewer can open the deployment first. */
export async function getPresentationFor(deploymentId: string): Promise<Presentation | null> {
  if (!isUuid(deploymentId)) return null;
  return (await listPresentations()).find((p) => p.deploymentId === deploymentId) ?? null;
}

/** Creates the deployment's presentation, or replaces the content of the one it has. */
export async function savePresentation(input: PresentationInput, userId: number | null): Promise<void> {
  const { deploymentId, ...content } = input;
  await db()`
    insert into deployment_presentations (deployment_id, content, created_by, updated_by)
    values (${deploymentId}, ${JSON.stringify(content)}::jsonb, ${userId}, ${userId})
    on conflict (deployment_id) do update set
      content = excluded.content, updated_by = excluded.updated_by, updated_at = now()
  `;
}

export async function deletePresentation(deploymentId: string): Promise<void> {
  if (!isUuid(deploymentId)) return;
  await db()`delete from deployment_presentations where deployment_id = ${deploymentId}`;
}
