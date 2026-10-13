import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { requireTeam } from "@/features/zrm/access";
import { RecordDetail } from "@/features/zrm/RecordDetail";
import { isKind } from "@/features/zrm/types";

/** One record, open in the right pane beside the list. */
export default async function RecordPage({ params }: PageProps<"/portal/zrm/[kind]/[id]">): Promise<ReactElement> {
  const { kind, id } = await params;
  if (!isKind(kind)) notFound();
  await requireTeam(`/portal/zrm/${kind}/${id}`);
  return <RecordDetail kind={kind} id={id} />;
}
