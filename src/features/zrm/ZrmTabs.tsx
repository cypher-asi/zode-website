"use client";

import type { ReactElement } from "react";
import { PortalTabs } from "@/features/portal/PortalTabs";
import { KINDS, KIND_LABELS } from "./types";
import { useZrm } from "./ZrmProvider";

const TABS = KINDS.map((kind) => ({ href: `/portal/zrm/${kind}`, label: KIND_LABELS[kind].plural }));

/** People, Companies and Opportunities, at the top right of ZRM. */
export function ZrmTabs(): ReactElement {
  const { segments, go } = useZrm();
  return <PortalTabs tabs={TABS} label="ZRM sections" active={`/portal/zrm/${segments[0]}`} onSelect={go} />;
}
