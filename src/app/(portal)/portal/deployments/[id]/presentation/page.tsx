import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import ui from "@/features/data-room/ui.module.css";
import { getDeploymentFor } from "@/features/deployments/deployments";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { PageHeader } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";
import { draftPresentation } from "@/features/presentations/draft";
import { PresentationForm } from "@/features/presentations/PresentationForm";
import { PresentationPreview } from "@/features/presentations/PresentationPreview";
import { getPresentationFor } from "@/features/presentations/presentations";
import layout from "@/features/presentations/presentations.module.css";
import { presentationPdfPath } from "@/features/presentations/types";
import { requireTeam } from "@/features/zrm/access";

export const metadata: Metadata = {
  title: "Presentation | Deployments | ZODE",
  robots: { index: false, follow: false },
};

/**
 * A deployment's presentation for the ZODE team: a new one filled in from the
 * deployment's figures, or the saved one's editor beside a preview of its PDF.
 */
export default function PresentationPage({ params }: PageProps<"/portal/deployments/[id]/presentation">): ReactElement {
  return (
    <Suspense fallback={<PortalLoading />}>
      <Presentation params={params} />
    </Suspense>
  );
}

async function Presentation({
  params,
}: Pick<PageProps<"/portal/deployments/[id]/presentation">, "params">): Promise<ReactElement> {
  const { id } = await params;
  const account = await requireTeam(`/portal/deployments/${id}/presentation`);
  const deployment = await getDeploymentFor(id, { team: true, userId: account.userId });
  if (!deployment) notFound();
  const saved = await getPresentationFor(deployment.id);
  const deploymentLink = <Link href={`/portal/deployments/${deployment.id}`}>{deployment.name}</Link>;

  if (!saved) {
    return (
      <div className={styles.page}>
        <PageHeader
          title="New presentation"
          subtitle={
            <>
              Filled in from {deploymentLink}. Edit anything, add the site&apos;s own slides, then create it to preview
              and export the PDF.
            </>
          }
        />
        <PresentationForm presentation={draftPresentation(deployment, { name: account.displayName, email: account.email })} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="Presentation"
        subtitle={<>Slides for {deploymentLink}, for anyone who can open it.</>}
        actions={
          <a href={presentationPdfPath(deployment.id, true)} className={ui.primary} download>
            Download PDF
          </a>
        }
      />
      <div className={layout.layout}>
        <PresentationForm key={saved.updatedAt} presentation={saved} saved />
        <aside className={layout.preview} aria-label="Preview">
          <p className={layout.previewHead}>Preview of the saved presentation. Save to update it.</p>
          <PresentationPreview url={`${presentationPdfPath(deployment.id)}?v=${encodeURIComponent(saved.updatedAt)}`} />
        </aside>
      </div>
    </div>
  );
}
