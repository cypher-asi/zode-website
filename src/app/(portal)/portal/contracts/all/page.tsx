import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import Link from "next/link";
import { ContractTabs } from "@/features/contracts/ContractTabs";
import tabs from "@/features/data-room/room.module.css";
import ui from "@/features/data-room/ui.module.css";
import { loadAllContracts } from "@/features/portal/data";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { ContractList, Empty, PageHeader } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";
import { requireTeam } from "@/features/zrm/access";

export const metadata: Metadata = {
  title: "All agreements | Contracts | ZODE",
  robots: { index: false, follow: false },
};

/** Every MNDA anyone has signed, including those signed while logged out, and every compute contract. The ZODE team only. */
export default function AllContractsPage(): ReactElement {
  return (
    <div className={styles.page}>
      <PageHeader title="Contracts" subtitle="Every agreement signed with ZODE.">
        <div className={tabs.headerActions}>
          <Link href="/portal/contracts/new" className={ui.primary}>
            Record contract
          </Link>
          <ContractTabs current="all" />
        </div>
      </PageHeader>
      <Suspense fallback={<PortalLoading header={false} nested />}>
        <AllContracts />
      </Suspense>
    </div>
  );
}

async function AllContracts(): Promise<ReactElement> {
  await requireTeam("/portal/contracts/all");
  const contracts = await loadAllContracts();
  return contracts === null ? (
    <Empty>Agreements couldn&apos;t be loaded right now. Please try again shortly.</Empty>
  ) : contracts.length ? (
    <ContractList contracts={contracts} showSigner />
  ) : (
    <Empty>No agreements have been signed yet.</Empty>
  );
}
