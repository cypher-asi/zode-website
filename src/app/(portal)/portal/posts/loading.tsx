import type { ReactElement } from "react";
import { PortalLoading } from "@/features/portal/PortalLoading";

/** Opening a post from the list paints at once instead of waiting on the editor's access check and post. */
export default function Loading(): ReactElement {
  return <PortalLoading />;
}
