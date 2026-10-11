"use client";

import { useEffect, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { useLogout } from "./useAccount";

/** Logs out and hands over to the home page, prefetched so it appears at once. */
export function LogoutButton({ className }: { className: string }): ReactElement {
  const router = useRouter();
  const { logOut, pending } = useLogout();

  useEffect(() => {
    router.prefetch("/");
  }, [router]);

  return (
    <button type="button" className={className} disabled={pending} onClick={() => logOut()}>
      {pending ? "Logging out…" : "Log out"}
    </button>
  );
}
