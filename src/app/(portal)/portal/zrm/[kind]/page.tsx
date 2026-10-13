import { notFound } from "next/navigation";
import { requireTeam } from "@/features/zrm/access";
import { isKind } from "@/features/zrm/types";

/** Nothing open: the tab's layout shows the list across the whole panel. */
export default async function KindPage({ params }: PageProps<"/portal/zrm/[kind]">): Promise<null> {
  const { kind } = await params;
  if (!isKind(kind)) notFound();
  await requireTeam(`/portal/zrm/${kind}`);
  return null;
}
