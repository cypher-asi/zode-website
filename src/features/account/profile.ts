import "server-only";
import { cache } from "react";
import { unstable_rethrow } from "next/navigation";
import { db } from "@/lib/db";
import type { Account } from "./zos";

export const MAX_DISPLAY_NAME_LENGTH = 120;
export const MAX_AVATAR_BYTES = 5 * 1024 ** 2;
export const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** A user's own edits from portal settings; `null` means use what ZOS has. */
export interface Profile {
  displayName: string | null;
  avatarPathname: string | null;
}

/** Every photo a user uploads is stored under this prefix in the private Blob store. */
export const avatarBlobPrefix = (userId: string): string => `avatars/${userId}/`;

/** The blob's file name, which carries the upload's random suffix, so it changes with every new photo. */
export const avatarVersion = (pathname: string): string => pathname.slice(pathname.lastIndexOf("/") + 1);

export const avatarUrl = (userId: string, pathname: string): string =>
  `/api/account/avatar/${encodeURIComponent(userId)}?v=${encodeURIComponent(avatarVersion(pathname))}`;

/** The user's profile row, or `null` when there is none or it can't be read (ZOS values stand in). */
export async function loadProfile(userId: string): Promise<Profile | null> {
  try {
    const [row] = await db()`
      select display_name, avatar_pathname from account_profiles where user_id = ${userId}
    `;
    if (!row) return null;
    return {
      displayName: row.display_name == null ? null : String(row.display_name),
      avatarPathname: row.avatar_pathname == null ? null : String(row.avatar_pathname),
    };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[profile] lookup failed; using the ZOS profile", error);
    return null;
  }
}

/**
 * `loadProfile` once per request, shared by the session lookup and pages that
 * show the profile. Not for actions, which read it back after saving.
 */
export const loadRequestProfile = cache(loadProfile);

/** The account as the site shows it: ZOS's values, with the user's own edits on top. */
export function applyProfile(account: Account, profile: Profile | null): Account {
  if (!profile) return account;
  return {
    ...account,
    displayName: profile.displayName || account.displayName,
    profileImage: profile.avatarPathname ? avatarUrl(account.userId, profile.avatarPathname) : account.profileImage,
  };
}

export async function saveDisplayName(userId: string, displayName: string): Promise<void> {
  await db()`
    insert into account_profiles (user_id, display_name) values (${userId}, ${displayName})
    on conflict (user_id) do update set display_name = excluded.display_name, updated_at = now()
  `;
}

export async function saveAvatarPathname(userId: string, pathname: string | null): Promise<void> {
  await db()`
    insert into account_profiles (user_id, avatar_pathname) values (${userId}, ${pathname})
    on conflict (user_id) do update set avatar_pathname = excluded.avatar_pathname, updated_at = now()
  `;
}
