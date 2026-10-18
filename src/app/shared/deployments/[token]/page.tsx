import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { notFound } from "next/navigation";
import { getSharedDeployment } from "@/features/deployments/deployments";
import { SharedPdf } from "@/features/deployments/SharedPdf";
import styles from "@/features/deployments/shared.module.css";
import { deploymentFileName, sharedPdfPath, sharedWithDeployment, sharePath } from "@/features/deployments/types";
import { presentationFileName, presentationName, sharedPresentationPath } from "@/features/presentations/types";
import { ShareButton } from "@/features/profile/ProfileClient";
import { sharedTeaserPath, teaserFileName } from "@/features/teasers/types";

export async function generateMetadata({ params }: PageProps<"/shared/deployments/[token]">): Promise<Metadata> {
  const deployment = await getSharedDeployment((await params).token);
  return {
    title: deployment ? `${deployment.name} | ZODE` : "Deployment | ZODE",
    // Shared by link only.
    robots: { index: false, follow: false },
  };
}

/**
 * A deployment's public page, for anyone the ZODE team gave its link: its
 * PDF, with its external notes but not its internal ones, credit or data
 * room, and buttons to share the link and export the PDF, teaser and
 * presentation (unless either is kept to the ZODE team), like the company
 * profile. Lives outside `(site)`, like
 * /company-profile, so the PDF fills the window without the footer.
 */
export default function SharedDeploymentPage({ params }: PageProps<"/shared/deployments/[token]">): ReactElement {
  return (
    <main className={styles.page}>
      <Suspense>
        <SharedDeployment params={params} />
      </Suspense>
    </main>
  );
}

async function SharedDeployment({
  params,
}: Pick<PageProps<"/shared/deployments/[token]">, "params">): Promise<ReactElement> {
  const { token } = await params;
  const deployment = await getSharedDeployment(token);
  if (!deployment) notFound();
  const pdf = sharedPdfPath(token);
  return (
    <>
      <div className={styles.toolbar}>
        <ShareButton className={styles.action} srOnly={styles.srOnly} path={sharePath(token)} />
        <a className={styles.action} href={sharedPdfPath(token, true)} download={deploymentFileName(deployment.name)}>
          Export PDF
        </a>
        {sharedWithDeployment(deployment, "teaser") ? (
          <a className={styles.action} href={sharedTeaserPath(token, true)} download={teaserFileName(deployment.name)}>
            Export teaser
          </a>
        ) : null}
        {sharedWithDeployment(deployment, "presentation") ? (
          <a
            className={styles.action}
            href={sharedPresentationPath(token, true)}
            download={presentationFileName(presentationName(deployment))}
          >
            Export presentation
          </a>
        ) : null}
      </div>
      <SharedPdf url={`${pdf}?v=${encodeURIComponent(deployment.updatedAt)}`} />
    </>
  );
}
