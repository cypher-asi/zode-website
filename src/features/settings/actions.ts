"use server";

import { list } from "@vercel/blob";
import { refresh } from "next/cache";
import {
  AVATAR_TYPES,
  MAX_AVATAR_BYTES,
  MAX_DISPLAY_NAME_LENGTH,
  avatarBlobPrefix,
  saveAvatarPathname,
  saveDisplayName,
} from "@/features/account/profile";
import { getAccount, refreshProfileCookies } from "@/features/account/session";
import { blobInfo, deleteBlobs } from "@/features/data-room/blob";
import { singleLine } from "@/lib/validation";

export interface NameState {
  readonly error?: string;
  readonly saved?: boolean;
  /** Echoed back so the field keeps what was typed. */
  readonly name?: string;
}

export interface AvatarResult {
  readonly error?: string;
}

const SIGNED_OUT = "Your session has ended. Log in again to make changes.";
const SAVE_FAILED = "Couldn't save your changes right now. Please try again.";

/** Removes every photo under the user's prefix but `keep`, including uploads that were never set. */
async function deleteOtherAvatars(userId: string, keep: string | null): Promise<void> {
  try {
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: avatarBlobPrefix(userId), cursor, limit: 1000 });
      await deleteBlobs(page.blobs.map((blob) => blob.pathname).filter((pathname) => pathname !== keep));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  } catch (error) {
    console.error("[settings] couldn't clean up old avatars", userId, error);
  }
}

export async function updateNameAction(_prevState: NameState, formData: FormData): Promise<NameState> {
  const account = await getAccount();
  if (!account) return { error: SIGNED_OUT };

  const name = singleLine(String(formData.get("name") ?? ""));
  if (!name) return { error: "Enter your name.", name };
  if (name.length > MAX_DISPLAY_NAME_LENGTH) return { error: "That name is too long.", name };

  try {
    await saveDisplayName(account.userId, name);
  } catch (error) {
    console.error("[settings] couldn't save name", error);
    return { error: SAVE_FAILED, name };
  }
  await refreshProfileCookies();
  refresh();
  return { saved: true, name };
}

/** Sets a photo the browser has just uploaded under the user's prefix. */
export async function setAvatarAction(pathname: string): Promise<AvatarResult> {
  const account = await getAccount();
  if (!account) return { error: SIGNED_OUT };
  if (typeof pathname !== "string" || !pathname.startsWith(avatarBlobPrefix(account.userId)) || pathname.includes("..")) {
    return { error: "That upload doesn't belong to your account." };
  }

  const info = await blobInfo(pathname);
  if (!info) return { error: "The upload didn't finish. Try again." };
  if (!AVATAR_TYPES.includes(info.contentType) || info.size > MAX_AVATAR_BYTES) {
    await deleteBlobs([pathname]);
    return { error: "Choose a PNG, JPEG, WebP or GIF image under 5 MB." };
  }

  try {
    await saveAvatarPathname(account.userId, pathname);
  } catch (error) {
    console.error("[settings] couldn't save avatar", error);
    return { error: SAVE_FAILED };
  }
  await deleteOtherAvatars(account.userId, pathname);
  await refreshProfileCookies();
  refresh();
  return {};
}

export async function removeAvatarAction(): Promise<AvatarResult> {
  const account = await getAccount();
  if (!account) return { error: SIGNED_OUT };

  try {
    await saveAvatarPathname(account.userId, null);
  } catch (error) {
    console.error("[settings] couldn't remove avatar", error);
    return { error: SAVE_FAILED };
  }
  await deleteOtherAvatars(account.userId, null);
  await refreshProfileCookies();
  refresh();
  return {};
}
