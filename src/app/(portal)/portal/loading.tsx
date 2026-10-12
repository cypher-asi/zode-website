import type { ReactElement } from "react";
import { PortalLoading } from "@/features/portal/PortalLoading";

/** Prefetched with every portal link, so switching sections paints at once while the page's data streams in. */
export default function Loading(): ReactElement {
  return <PortalLoading />;
}
