import "server-only";
import {
  BlobNotFoundError,
  del,
  get,
  head,
  issueSignedToken,
  list,
  presignUrl,
  type HeadBlobResult,
} from "@vercel/blob";

/** Every file in a room is stored under this prefix in the private Blob store. */
export const roomBlobPrefix = (roomId: string): string => `data-rooms/${roomId}/`;

/** Streams a blob, passing a `Range` through so media can seek. */
export function readBlob(pathname: string, range: string | null) {
  return get(pathname, { access: "private", headers: range ? { range } : undefined });
}

/**
 * Blob checks expiry on every request, including the range requests a browser
 * sends to resume a download, so this must outlast a multi-gigabyte download
 * on a slow link; a shorter one fails partway with 403 Forbidden.
 */
const DOWNLOAD_URL_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * A signed URL that downloads one blob straight from Blob storage as an
 * attachment, so large files don't stream through (and time out in) a
 * function. Anyone holding it can use it until it expires; check access first.
 */
export async function presignedDownloadUrl(pathname: string): Promise<string> {
  const [url] = await presignedDownloadUrls([pathname]);
  return url;
}

/**
 * Signed download URLs for many blobs with one token request. The token's
 * signing key stays on the server, so each URL opens only its own blob.
 */
export async function presignedDownloadUrls(pathnames: string[]): Promise<string[]> {
  if (!pathnames.length) return [];
  const validUntil = Date.now() + DOWNLOAD_URL_TTL_MS;
  const token = await issueSignedToken({
    pathname: pathnames.length === 1 ? pathnames[0] : "*",
    operations: ["get"],
    validUntil,
  });
  return Promise.all(
    pathnames.map(async (pathname) => {
      const { presignedUrl } = await presignUrl(token, { operation: "get", pathname, validUntil, access: "private" });
      const url = new URL(presignedUrl);
      url.searchParams.set("download", "1");
      return url.toString();
    }),
  );
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

/** Removes every blob under `prefix`, including uploads that were never registered. */
export async function deleteBlobsUnder(prefix: string): Promise<void> {
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    await deleteBlobs(page.blobs.map((blob) => blob.pathname));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
}

/** Removes every blob under a room's prefix. */
export const deleteRoomBlobs = (roomId: string): Promise<void> => deleteBlobsUnder(roomBlobPrefix(roomId));
