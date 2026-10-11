"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { REMEMBER_COOKIE, clearRememberCookie, readRememberCookie, rememberAccount } from "./rememberedAccounts";

/**
 * Moves a fresh sign-in from the `zode_remember` cookie into localStorage.
 * Signing in redirects with a client navigation that keeps the root layout
 * mounted, so this checks again on every route change, not just on load.
 */
export function RememberAccount(): null {
  const pathname = usePathname();

  useEffect(() => {
    if (!document.cookie.includes(`${REMEMBER_COOKIE}=`)) return;
    const identity = readRememberCookie(document.cookie);
    if (identity) rememberAccount(identity);
    clearRememberCookie();
  }, [pathname]);

  return null;
}
