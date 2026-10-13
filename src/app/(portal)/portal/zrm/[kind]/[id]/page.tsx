import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { requireTeam } from "@/features/zrm/access";
import { loadRecord, RecordDetail } from "@/features/zrm/RecordDetail";
import { isKind } from "@/features/zrm/types";

/** One record, open in the right pane beside the list. Loads alongside the team check, rendering only once it passes. */
export default async function RecordPage({ params }: PageProps<"/portal/zrm/[kind]/[id]">): Promise<ReactElement> {
  const { kind, id } = await params;
  if (!isKind(kind)) notFound();
  const [, record] = await Promise.all([requireTeam(`/portal/zrm/${kind}/${id}`), loadRecord(kind, id)]);
  if (!record) notFound();
  return <RecordDetail record={record} />;
}
