"use server";

import { deleteAccountSession } from "./account-session";

/** Clears the session; callers decide whether to navigate (see `useLogout`). */
export async function logout(): Promise<void> {
  await deleteAccountSession();
}
