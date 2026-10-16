import { Suspense, type ReactElement } from "react";
import { redirect } from "next/navigation";

/** The BOM is a tab of the deployment's page. */
export default function DeploymentBomPage({ params }: PageProps<"/portal/deployments/[id]/bom">): ReactElement {
  return (
    <Suspense fallback={null}>
      <ToTab params={params} />
    </Suspense>
  );
}

async function ToTab({ params }: Pick<PageProps<"/portal/deployments/[id]/bom">, "params">): Promise<never> {
  const { id } = await params;
  redirect(`/portal/deployments/${encodeURIComponent(id)}?tab=bom`);
}
