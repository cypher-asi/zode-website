import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import Link from "next/link";
import ui from "@/features/data-room/ui.module.css";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { Empty, PageHeader } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";
import { TeaserList } from "@/features/teasers/TeaserList";
import { listTeasers } from "@/features/teasers/teasers";
import { requireTeam } from "@/features/zrm/access";

export const metadata: Metadata = {
  title: "Teasers | Deployments | ZODE",
  robots: { index: false, follow: false },
};

/** The ZODE team's one-page compute offering teasers. */
export default function TeasersPage(): ReactElement {
  return (
    <div className={styles.page}>
      <PageHeader
        title="Teasers"
        subtitle="One-page compute offerings, started from a deployment and exported as PDF."
        actions={
          <Link href="/portal/deployments/teasers/new" className={ui.primary}>
            New teaser
          </Link>
        }
      />
      <Suspense fallback={<PortalLoading header={false} nested />}>
        <Teasers />
      </Suspense>
    </div>
  );
}

async function Teasers(): Promise<ReactElement> {
  await requireTeam("/portal/deployments/teasers");
  const teasers = await listTeasers();
  return teasers.length ? (
    <TeaserList teasers={teasers} />
  ) : (
    <Empty>
      No teasers yet. <Link href="/portal/deployments/teasers/new">Start one from a deployment</Link>.
    </Empty>
  );
}
