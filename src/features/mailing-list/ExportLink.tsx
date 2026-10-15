"use client";

import type { ReactElement } from "react";
import { useSearchParams } from "next/navigation";
import ui from "@/features/data-room/ui.module.css";
import { isSubscriberStatus, type MailingList } from "./types";

/** The CSV of a list, or of both, narrowed to the status the page is filtered to. */
export function ExportLink({ list }: { list: MailingList | null }): ReactElement {
  const status = useSearchParams().get("status");
  const query = new URLSearchParams({
    ...(list ? { list } : {}),
    ...(isSubscriberStatus(status) ? { status } : {}),
  }).toString();
  return (
    <a className={ui.button} href={`/api/mailing-list/export${query ? `?${query}` : ""}`} download>
      Export CSV
    </a>
  );
}
