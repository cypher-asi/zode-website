import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { ComputeDealForm } from "@/features/contracts/ComputeDealForm";
import { listContractLinks } from "@/features/contracts/contracts";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { Empty, PageHeader } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";
import { requireTeam } from "@/features/zrm/access";

export const metadata: Metadata = {
  title: "Record deal | Contracts | ZODE",
  robots: { index: false, follow: false },
};

/** Where the ZODE team records a compute deal signed outside the portal. */
export default function NewContractPage(): ReactElement {
  return (
    <div className={styles.page}>
      <PageHeader
        title="Record a compute deal"
        subtitle="A closed Compute opportunity's executed MSA and order forms, and their terms."
      />
      <Suspense fallback={<PortalLoading header={false} nested />}>
        <NewContract />
      </Suspense>
    </div>
  );
}

async function NewContract(): Promise<ReactElement> {
  await requireTeam("/portal/contracts/new");
  const links = await listContractLinks().catch((error: unknown) => {
    console.error("Failed to load contract links", error);
    return null;
  });
  return links ? (
    <ComputeDealForm opportunities={links.opportunities} sites={links.sites} />
  ) : (
    <Empty>The form couldn&apos;t be loaded right now. Please try again shortly.</Empty>
  );
}
