import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { notFound } from "next/navigation";
import { ShareButton } from "@/features/profile/ProfileClient";
import { getSharedDoc } from "./deployments";
import { docFileName } from "./docs";
import { SharedPdf } from "./SharedPdf";
import styles from "./shared.module.css";
import { docSharedPdfPath, docSharePath, type DeploymentDoc } from "./types";

const LABELS: Record<DeploymentDoc, string> = { teaser: "Teaser", presentation: "Presentation" };

export async function sharedDocMetadata(doc: DeploymentDoc, token: string): Promise<Metadata> {
  const deployment = await getSharedDoc(doc, token);
  return {
    title: deployment ? `${deployment.name} ${LABELS[doc]} | ZODE` : `${LABELS[doc]} | ZODE`,
    // Shared by link only.
    robots: { index: false, follow: false },
  };
}

/**
 * A teaser or presentation shared on its own, for anyone the ZODE team gave
 * its link: just that document in the PDF viewer, with buttons to share the
 * link and download it, like a deployment's public page.
 */
export function SharedDocPage({ doc, token }: { doc: DeploymentDoc; token: Promise<string> }): ReactElement {
  return (
    <main className={styles.page}>
      <Suspense>
        <SharedDoc doc={doc} token={token} />
      </Suspense>
    </main>
  );
}

async function SharedDoc({ doc, token: tokenPromise }: { doc: DeploymentDoc; token: Promise<string> }): Promise<ReactElement> {
  const token = await tokenPromise;
  const deployment = await getSharedDoc(doc, token);
  if (!deployment) notFound();
  return (
    <>
      <div className={styles.toolbar}>
        <ShareButton className={styles.action} srOnly={styles.srOnly} path={docSharePath(doc, token)} />
        <a className={styles.action} href={docSharedPdfPath(doc, token, true)} download={docFileName(deployment, doc)}>
          Download
        </a>
      </div>
      <SharedPdf url={`${docSharedPdfPath(doc, token)}?v=${encodeURIComponent(deployment.updatedAt)}`} />
    </>
  );
}
