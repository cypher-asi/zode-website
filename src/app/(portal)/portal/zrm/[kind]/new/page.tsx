import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { isUuid, requireTeam } from "@/features/zrm/access";
import { NewRecordForm } from "@/features/zrm/NewRecordForm";
import { loadRefOptions } from "@/features/zrm/RecordDetail";
import { isKind } from "@/features/zrm/types";

/** References a New form can be opened with, e.g. `?company_id=` from a company's People. */
const PREFILLS = ["company_id", "person_id"] as const;

export default async function NewRecordPage({
  params,
  searchParams,
}: PageProps<"/portal/zrm/[kind]/new">): Promise<ReactElement> {
  const { kind } = await params;
  if (!isKind(kind)) notFound();
  await requireTeam(`/portal/zrm/${kind}/new`);
  const [query, options] = await Promise.all([searchParams, loadRefOptions()]);

  const defaults: Record<string, string> = {};
  for (const key of PREFILLS) {
    const value = query[key];
    if (isUuid(value)) defaults[key] = value;
  }

  return <NewRecordForm key={JSON.stringify(defaults)} kind={kind} options={options} defaults={defaults} />;
}
