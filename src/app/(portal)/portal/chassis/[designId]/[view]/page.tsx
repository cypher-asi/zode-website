import { notFound } from "next/navigation";
import { Suspense, type ReactElement } from "react";
import { getDesign, listTargets } from "@/features/chassis/designs";
import { isDataView, viewHref } from "@/features/chassis/types";
import { BomView } from "@/features/chassis/ui/BomView";
import { ChecksView } from "@/features/chassis/ui/ChecksView";
import { DeploymentsView } from "@/features/chassis/ui/DeploymentsView";
import { PartsView } from "@/features/chassis/ui/PartsView";
import { RacksView } from "@/features/chassis/ui/RacksView";
import { VersionsView } from "@/features/chassis/ui/VersionsView";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { requireTeam } from "@/features/zrm/access";

/** One of the open design's data pages: BOM, parts, racks, checks, versions or deployments. */
export default function DataViewPage({ params }: PageProps<"/portal/chassis/[designId]/[view]">): ReactElement {
  return (
    <Suspense fallback={<PortalLoading />}>
      <DataView params={params} />
    </Suspense>
  );
}

async function DataView({
  params,
}: Pick<PageProps<"/portal/chassis/[designId]/[view]">, "params">): Promise<ReactElement> {
  const { designId, view } = await params;
  if (!isDataView(view)) notFound();
  await requireTeam(viewHref(designId, view));

  switch (view) {
    case "bom":
      return <BomView />;
    case "parts":
      return <PartsView />;
    case "racks":
      return <RacksView />;
    case "checks":
      return <ChecksView />;
    case "versions": {
      const design = await getDesign(designId);
      if (!design) notFound();
      return <VersionsView designId={design.id} designName={design.name} versions={design.versions} />;
    }
    case "deployments": {
      const [design, targets] = await Promise.all([getDesign(designId), listTargets()]);
      if (!design) notFound();
      return <DeploymentsView designId={design.id} uses={design.uses} targets={targets} />;
    }
  }
}
