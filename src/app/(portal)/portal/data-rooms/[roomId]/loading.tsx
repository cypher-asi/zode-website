import type { ReactElement } from "react";
import { PortalLoading } from "@/features/portal/PortalLoading";

/** Switching a room's tabs keeps its bar and fills the body while the tab loads. */
export default function Loading(): ReactElement {
  return <PortalLoading header={false} />;
}
