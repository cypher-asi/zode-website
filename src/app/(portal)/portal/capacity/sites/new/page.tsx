import type { ReactElement } from "react";
import { isUuid } from "@/features/zrm/access";
import { NewRecordForm } from "@/features/zrm/NewRecordForm";

/** References the New form can be opened with, e.g. `?provider_company_id=` from a company's Sites. */
const PREFILLS = ["provider_company_id"] as const;

/** Renders no data (its pickers come from the layout's lists, and saving re-checks the team), so it skips the team check. */
export default async function NewSitePage({ searchParams }: PageProps<"/portal/capacity/sites/new">): Promise<ReactElement> {
  const query = await searchParams;
  const defaults: Record<string, string> = {};
  for (const key of PREFILLS) {
    const value = query[key];
    if (isUuid(value)) defaults[key] = value;
  }
  return <NewRecordForm key={JSON.stringify(defaults)} kind="sites" defaults={defaults} />;
}
