import type { ReactElement } from "react";
import { PortalLoading } from "@/features/portal/PortalLoading";

/** Opening a record keeps the list and fills the right pane while it loads. */
export default function Loading(): ReactElement {
  return <PortalLoading header={false} />;
}
