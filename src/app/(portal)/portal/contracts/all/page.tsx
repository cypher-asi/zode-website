import type { Metadata } from "next";
import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { isZodeAdmin } from "@/features/account/admin";
import { requireAccount } from "@/features/account/session";
import { ContractTabs } from "@/features/contracts/ContractTabs";
import { loadAllContracts } from "@/features/portal/data";
import { ContractList, Empty, PageHeader } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";

export const metadata: Metadata = {
  title: "All agreements | Contracts | ZODE",
  robots: { index: false, follow: false },
};

/** Every MNDA anyone has signed, including those signed while logged out. ZODE admins only. */
export default async function AllContractsPage(): Promise<ReactElement> {
  const account = await requireAccount("/portal/contracts/all");
  if (!(await isZodeAdmin(account))) notFound();
  const contracts = await loadAllContracts();

  return (
    <div className={styles.page}>
      <PageHeader title="Contracts" subtitle="Every agreement signed with ZODE.">
        <ContractTabs current="all" />
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
