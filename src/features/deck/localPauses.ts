import { useEffect, useState } from "react";
import type { LocalPauses } from "./policyTypes";

let pending: Promise<LocalPauses> | null = null;

/** Fetched once per page and shared; a failed fetch is tried again by the next caller. */
function loadLocalPauses(): Promise<LocalPauses> {
  pending ??= fetch("/deck/local-pauses")
    .then((response) => {
      if (!response.ok) throw new Error(`local pauses: HTTP ${response.status}`);
      return response.json() as Promise<LocalPauses>;
    })
    .catch((error: unknown) => {
      pending = null;
      throw error;
    });
  return pending;
}

/**
 * The tracker's local pauses (app/deck/local-pauses), fetched once `wanted`:
 * undefined until they arrive, null if they couldn't be read.
 */
export function useLocalPauses(wanted: boolean): LocalPauses | null | undefined {
  const [pauses, setPauses] = useState<LocalPauses | null | undefined>(undefined);
  useEffect(() => {
    if (!wanted || pauses !== undefined) return;
    let live = true;
    loadLocalPauses().then(
      (loaded) => live && setPauses(loaded),
      (error: unknown) => {
        console.error("[deck] local pauses unavailable", error);
        if (live) setPauses(null);
      },
    );
    return () => {
      live = false;
    };
  }, [wanted, pauses]);
  return pauses;
}
