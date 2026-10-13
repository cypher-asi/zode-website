import type { Metadata } from "next";
import type { ReactElement } from "react";
import Link from "next/link";
import { ContractTabs } from "@/features/contracts/ContractTabs";
import contractStyles from "@/features/contracts/contracts.module.css";
import ui from "@/features/data-room/ui.module.css";
import { loadAllContracts } from "@/features/portal/data";
import { ContractList, Empty, PageHeader } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";
import { requireTeam } from "@/features/zrm/access";

export const metadata: Metadata = {
  title: "All agreements | Contracts | ZODE",
  robots: { index: false, follow: false },
};

/** Every MNDA anyone has signed, including those signed while logged out, and every compute contract. The ZODE team only. */
export default async function AllContractsPage(): Promise<ReactElement> {
  await requireTeam("/portal/contracts/all");
  const contracts = await loadAllContracts();

  return (
    <div className={styles.page}>
      <PageHeader title="Contracts" subtitle="Every agreement signed with ZODE.">
        <div className={contractStyles.headerActions}>
          <Link href="/portal/contracts/new" className={ui.primary}>
            Record contract
          </Link>
          <ContractTabs current="all" />
        </div>
      </PageHeader>
      {contracts === null ? (
        <Empty>Agreements couldn&apos;t be loaded right now. Please try again shortly.</Empty>
      ) : contracts.length ? (
        <ContractList contracts={contracts} showSigner />
      ) : (
        <Empty>No agreements have been signed yet.</Empty>
      )}
    </div>
  );
}
