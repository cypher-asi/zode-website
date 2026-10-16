import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { notFound } from "next/navigation";
import { getBom } from "@/features/deployments/bom/bom";
import { BomEditor } from "@/features/deployments/bom/BomEditor";
import { getDeploymentFor } from "@/features/deployments/deployments";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { PageHeader } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";
import { requireTeam } from "@/features/zrm/access";

export const metadata: Metadata = {
  title: "Edit BOM | Deployments | ZODE",
  robots: { index: false, follow: false },
};

/** Where the ZODE team edits a deployment's bill of materials. */
export default function EditBomPage({ params }: PageProps<"/portal/deployments/[id]/bom/edit">): ReactElement {
  return (
    <Suspense fallback={<PortalLoading />}>
      <EditBom params={params} />
    </Suspense>
  );
}

async function EditBom({ params }: Pick<PageProps<"/portal/deployments/[id]/bom/edit">, "params">): Promise<ReactElement> {
  const { id } = await params;
  const account = await requireTeam(`/portal/deployments/${id}/bom/edit`);
  const deployment = await getDeploymentFor(id, { team: true, userId: account.userId });
  if (!deployment) notFound();
  const bom = await getBom(deployment.id);

  return (
    <div className={styles.page}>
      <PageHeader
        title={`${deployment.name} BOM`}
        subtitle="Lines picked from the quotes' price lists, each filling a cluster builder slot for a phase. Only the ZODE team sees this."
      />
      <BomEditor deployment={deployment} bom={bom} />
    </div>
  );
}
