"use client";

import { useCallback, useSyncExternalStore, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "./actions";
import { readSignedInCookie } from "./signedInCookie";

/** Pages that need a signed-in account; logging out on one returns home. */
const ACCOUNT_ONLY_PATHS = ["/portal"];

const TOAST_MS = 2600;
const TOAST_EXIT_MS = 240;

export type LogoutToast = "hidden" | "shown" | "leaving";

// Module state, so the notice survives the client navigation off an account page.
let toast: LogoutToast = "hidden";
let toastTimers: number[] = [];
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab may have signed in or out.
  window.addEventListener("focus", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("focus", listener);
  };
}

function showLogoutToast(): void {
  for (const timer of toastTimers) window.clearTimeout(timer);
  toast = "shown";
  notify();
  toastTimers = [
    window.setTimeout(() => {
      toast = "leaving";
      notify();
    }, TOAST_MS),
    window.setTimeout(() => {
      toast = "hidden";
      notify();
    }, TOAST_MS + TOAST_EXIT_MS),
  ];
}

/** Re-reads the account cookies, after a profile edit has rewritten the initials in them. */
export function accountCookiesChanged(): void {
  notify();
}

/** Whether `pathname` is in the signed-in portal. */
export function isPortalPath(pathname: string): boolean {
  return ACCOUNT_ONLY_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * The signed-in account's initials per the hint cookie (empty for older
 * sessions), or `null` when signed out. Always `null` on the server and during
 * hydration, since pages render statically.
 */
export function useAccountInitials(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => readSignedInCookie(document.cookie),
    () => null,
  );
}
export function useLogoutToast(): LogoutToast {
  return useSyncExternalStore(
    subscribe,
    () => toast,
    () => "hidden",
  );
}

/**
 * Logs out without reloading: public pages stay put and just re-render signed
 * out; account-only pages hand over to the home page.
 */
export function useLogout(): { logOut: (onDone?: () => void) => void; pending: boolean } {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const [pending, startTransition] = useTransition();

  const logOut = useCallback(
    (onDone?: () => void) => {
      startTransition(async () => {
        await logout();
        onDone?.();
        showLogoutToast();
        if (isPortalPath(pathname)) {
          router.replace("/");
        }
      });
    },
    [pathname, router],
  );

  return { logOut, pending };
}
