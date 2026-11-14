import { notFound, redirect } from "next/navigation";
import { Suspense, type ReactElement } from "react";
import { getDesign } from "@/features/chassis/designs";
import { designHref, sheetHref, viewHref } from "@/features/chassis/types";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { requireTeam } from "@/features/zrm/access";

/** A design opens on its first sheet. */
export default function DesignPage({ params }: PageProps<"/portal/chassis/[designId]">): ReactElement {
  return (
    <Suspense fallback={<PortalLoading />}>
      <FirstSheet params={params} />
    </Suspense>
  );
}

async function FirstSheet({ params }: Pick<PageProps<"/portal/chassis/[designId]">, "params">): Promise<never> {
  const { designId } = await params;
  await requireTeam(designHref(designId));
  const design = await getDesign(designId);
  if (!design) notFound();
  const first = design.data.sheets.sheets[0];
  redirect(first ? sheetHref(designId, first.id) : viewHref(designId, "bom"));
}
