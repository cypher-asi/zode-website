"use client";

import type { ReactElement } from "react";
import ui from "@/features/data-room/ui.module.css";
import { Icon } from "./bits";
import { NEW_LABELS } from "./columns";
import { listHref } from "./types";
import { useZrmData, useZrmRoute, ZrmLink } from "./ZrmProvider";

/** A new record of the open list's kind, at the far right of the app's bar. */
export function ZrmNewButton(): ReactElement | null {
  const { kinds } = useZrmData();
  const { segments } = useZrmRoute();
  const kind = kinds.find((k) => k === segments[0]);
  if (!kind) return null;
  return (
    <ZrmLink href={`${listHref(kind)}/new`} className={ui.primary}>
      <Icon name="plus" />
      {NEW_LABELS[kind]}
    </ZrmLink>
  );
}
