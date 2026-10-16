import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { notFound } from "next/navigation";
import { listFileNames } from "@/features/data-room/rooms";
import { getBom } from "@/features/deployments/bom/bom";
import { BomEditor } from "@/features/deployments/bom/BomEditor";
import { getDeployment } from "@/features/deployments/deployments";
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
  await requireTeam(`/portal/deployments/${id}/bom/edit`);
  const deployment = await getDeployment(id);
  if (!deployment) notFound();
  const [bom, files] = await Promise.all([
    getBom(deployment.id),
    deployment.dataRoomId ? listFileNames(deployment.dataRoomId) : Promise.resolve([]),
  ]);

  return (
    <div className={styles.page}>
      <PageHeader
        title={`${deployment.name} BOM`}
        subtitle="Quotes and their lines, each filling the cluster builder's slots for a phase. Only the ZODE team sees this."
      />
      <BomEditor
        deployment={deployment}
        bom={bom}
        files={[...files].sort((a, b) => a.name.localeCompare(b.name))}
      />
    </div>
  );
}
