import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDeploymentFor } from "@/features/deployments/deployments";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { PageHeader } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";
import { draftFromDeployment } from "@/features/teasers/draft";
import { OfferPicker } from "@/features/teasers/OfferPicker";
import { TeaserForm } from "@/features/teasers/TeaserForm";
import { requireTeam } from "@/features/zrm/access";

export const metadata: Metadata = {
  title: "New teaser | Deployments | ZODE",
  robots: { index: false, follow: false },
};

/** A new teaser for one deployment, filled in from its figures for the ZODE team to edit. */
export default function NewTeaserPage({
  params,
  searchParams,
}: PageProps<"/portal/deployments/[id]/teasers/new">): ReactElement {
  return (
    <Suspense fallback={<PortalLoading />}>
      <NewTeaser params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function NewTeaser({ params, searchParams }: PageProps<"/portal/deployments/[id]/teasers/new">): Promise<ReactElement> {
  const [{ id }, { phase }] = await Promise.all([params, searchParams]);
  const account = await requireTeam(`/portal/deployments/${id}/teasers/new`);
  const deployment = await getDeploymentFor(id, { team: true, userId: account.userId });
  if (!deployment) notFound();

  const picked = [phase ?? []]
    .flat()
    .map(Number)
    .filter((i) => Number.isInteger(i) && i >= 0 && i < deployment.phases.length);
  const phases = picked.length ? picked : null;
  const draft = draftFromDeployment(deployment, { name: account.displayName, email: account.email }, phases);

  return (
    <div className={styles.page}>
      <PageHeader
        title="New teaser"
        subtitle={
          <>
            Filled in from <Link href={`/portal/deployments/${deployment.id}`}>{deployment.name}</Link>. Edit
            anything, then create it to preview and export the PDF.
          </>
        }
      />
      {deployment.phases.length > 1 ? (
        <OfferPicker key={phases?.join() ?? "all"} deployment={deployment} phases={phases} />
      ) : null}
      <TeaserForm key={phases?.join() ?? "all"} teaser={draft} />
    </div>
  );
}
