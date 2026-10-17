"use client";

import type { ReactElement } from "react";
import { OverlayScrollbar } from "@/components/ui/OverlayScrollbar";

/**
 * A preview's scrollbars, both ways since zoomed files scroll sideways too,
 * floated over the preview's own scroll area (its native bars hidden) in its
 * positioned parent.
 */
export function Scrollbars({ targetId }: { targetId: string }): ReactElement {
  return (
    <>
      <OverlayScrollbar targetId={targetId} showOnHover />
      <OverlayScrollbar targetId={targetId} axis="x" showOnHover />
    </>
  );
}
