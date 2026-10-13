import type { ReactElement } from "react";
import { PortalLoading } from "@/features/portal/PortalLoading";

/**
 * Wraps each room's layout, which [roomId]/loading.tsx can't, so stepping into
 * a room or back out to the list paints at once instead of waiting on the
 * room's access check.
 */
export default function Loading(): ReactElement {
  return <PortalLoading />;
}
