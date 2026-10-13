import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { requireTeam } from "@/features/zrm/access";
import { loadRecord, RecordDetail } from "@/features/zrm/RecordDetail";

/** One site, open in the right pane beside the list. Loads alongside the team check, rendering only once it passes. */
export default async function SitePage({ params }: PageProps<"/portal/capacity/sites/[id]">): Promise<ReactElement> {
  const { id } = await params;
  const [, record] = await Promise.all([requireTeam(`/portal/capacity/sites/${id}`), loadRecord("sites", id)]);
  if (!record) notFound();
  return <RecordDetail record={record} />;
}
