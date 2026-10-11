import "server-only";
import { BlobNotFoundError, del, get, head, list, type HeadBlobResult } from "@vercel/blob";

/** Every file in a room is stored under this prefix in the private Blob store. */
export const roomBlobPrefix = (roomId: string): string => `data-rooms/${roomId}/`;

/** Streams a blob, passing a `Range` through so media can seek. */
export function readBlob(pathname: string, range: string | null) {
  return get(pathname, { access: "private", headers: range ? { range } : undefined });
}

export async function blobInfo(pathname: string): Promise<HeadBlobResult | null> {
  try {
    return await head(pathname);
  } catch (error) {
    if (error instanceof BlobNotFoundError) return null;
    throw error;
  }
}

/** Best effort: the database row is what grants access, so a leftover blob is unreachable anyway. */
export async function deleteBlobs(pathnames: string[]): Promise<void> {
  if (!pathnames.length) return;
  try {
    await del(pathnames);
  } catch (error) {
    console.error("[data-room] failed to delete blobs", pathnames, error);
  }
}

/** Removes every blob under a room's prefix, including uploads that were never registered. */
export async function deleteRoomBlobs(roomId: string): Promise<void> {
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: roomBlobPrefix(roomId), cursor, limit: 1000 });
    await deleteBlobs(page.blobs.map((blob) => blob.pathname));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
}
