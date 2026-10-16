import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import ui from "@/features/data-room/ui.module.css";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { PageHeader } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";
import { TeaserForm } from "@/features/teasers/TeaserForm";
import { TeaserPreview } from "@/features/teasers/TeaserPreview";
import { getTeaser } from "@/features/teasers/teasers";
import teasers from "@/features/teasers/teasers.module.css";
import { requireTeam } from "@/features/zrm/access";

export const metadata: Metadata = {
  title: "Teaser | Deployments | ZODE",
  robots: { index: false, follow: false },
};

/** One teaser: its editor beside a preview of the saved PDF, and the PDF to download. The ZODE team only. */
export default function TeaserPage({ params }: PageProps<"/portal/deployments/teasers/[teaserId]">): ReactElement {
  return (
    <Suspense fallback={<PortalLoading />}>
      <Teaser params={params} />
    </Suspense>
  );
}

async function Teaser({
  params,
}: Pick<PageProps<"/portal/deployments/teasers/[teaserId]">, "params">): Promise<ReactElement> {
  const { teaserId } = await params;
  await requireTeam(`/portal/deployments/teasers/${teaserId}`);
  const teaser = await getTeaser(teaserId);
  if (!teaser) notFound();
  const pdf = `/api/teasers/${teaser.id}/pdf`;

  return (
    <div className={styles.page}>
      <PageHeader
        title={teaser.name}
        subtitle={
          teaser.deploymentId ? (
            <>
              From <Link href={`/portal/deployments/${teaser.deploymentId}`}>{teaser.deploymentName}</Link>
            </>
          ) : (
            "Its deployment was deleted; the teaser keeps what it said."
          )
        }
        actions={
          <a href={`${pdf}?download=1`} className={ui.primary} download>
            Download PDF
          </a>
        }
      />
      <div className={teasers.layout}>
        <TeaserForm key={teaser.updatedAt} teaser={teaser} id={teaser.id} />
        <aside className={teasers.preview} aria-label="Preview">
          <p className={teasers.previewHead}>Preview of the saved teaser. Save to update it.</p>
          <TeaserPreview url={`${pdf}?v=${encodeURIComponent(teaser.updatedAt)}`} />
        </aside>
      </div>
    </div>
  );
}
