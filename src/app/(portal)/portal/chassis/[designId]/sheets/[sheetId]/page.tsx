import { Suspense, type ReactElement } from "react";
import { sheetHref } from "@/features/chassis/types";
import { SheetView } from "@/features/chassis/ui/SheetView";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { requireTeam } from "@/features/zrm/access";

/** One sheet of the open design, drawn from the editor's data. */
export default function SheetPage({ params }: PageProps<"/portal/chassis/[designId]/sheets/[sheetId]">): ReactElement {
  return (
    <Suspense fallback={<PortalLoading />}>
      <Sheet params={params} />
    </Suspense>
  );
}

async function Sheet({
  params,
}: Pick<PageProps<"/portal/chassis/[designId]/sheets/[sheetId]">, "params">): Promise<ReactElement> {
  const { designId, sheetId } = await params;
  await requireTeam(sheetHref(designId, sheetId));
  return <SheetView designId={designId} sheetId={decodeURIComponent(sheetId)} />;
}
