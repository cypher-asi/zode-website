import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactElement } from "react";
import { FlowOutline } from "@/features/factory/FlowOutline";
import { flowById } from "@/features/factory/model/flows";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { requireTeam } from "@/features/zrm/access";

export const metadata: Metadata = {
  title: "Factory | ZODE",
  robots: { index: false, follow: false },
};

/** A factory flow that's outlined but not yet simulated. */
export default function FlowPage({ params }: PageProps<"/portal/factory/[flow]">): ReactElement {
  return (
    <Suspense fallback={<PortalLoading />}>
      <Flow params={params} />
    </Suspense>
  );
}

async function Flow({ params }: Pick<PageProps<"/portal/factory/[flow]">, "params">): Promise<ReactElement> {
  const { flow: id } = await params;
  const flow = flowById(id);
  if (!flow || flow.built) notFound();
  await requireTeam(flow.href);
  return <FlowOutline flow={flow} />;
}
