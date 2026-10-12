import "server-only";
import { list } from "@vercel/blob";
import { deleteBlobs } from "@/features/data-room/blob";
import { MEDIA_PREFIX } from "./types";

/** Every image uploaded for a post is stored under this prefix. */
export const postBlobPrefix = (postId: string): string => `${MEDIA_PREFIX}${postId}/`;

export async function deletePostBlobs(postId: string): Promise<void> {
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: postBlobPrefix(postId), cursor, limit: 1000 });
    await deleteBlobs(page.blobs.map((blob) => blob.pathname));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
}
