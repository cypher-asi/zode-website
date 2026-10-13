import { notFound } from "next/navigation";
import { isKind } from "@/features/zrm/types";

/**
 * Nothing open: the ZRM layout shows the tab's list across the whole panel.
 * Renders no data, so it skips the team check the layout made on the way in,
 * which keeps switching tabs to a round trip with no database work.
 */
export default async function KindPage({ params }: PageProps<"/portal/zrm/[kind]">): Promise<null> {
  const { kind } = await params;
  if (!isKind(kind)) notFound();
  return null;
}
