import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { isUuid } from "@/features/zrm/access";
import { NewRecordForm } from "@/features/zrm/NewRecordForm";
import { isKind } from "@/features/zrm/types";

/** References a New form can be opened with, e.g. `?company_id=` from a company's People. */
const PREFILLS = ["company_id", "person_id"] as const;

/** Renders no data (its pickers come from the ZRM layout's lists, and saving re-checks the team), so it skips the team check. */
export default async function NewRecordPage({
  params,
  searchParams,
}: PageProps<"/portal/zrm/[kind]/new">): Promise<ReactElement> {
  const [{ kind }, query] = await Promise.all([params, searchParams]);
  if (!isKind(kind)) notFound();

  const defaults: Record<string, string> = {};
  for (const key of PREFILLS) {
    const value = query[key];
    if (isUuid(value)) defaults[key] = value;
  }

  return <NewRecordForm key={JSON.stringify(defaults)} kind={kind} defaults={defaults} />;
}
