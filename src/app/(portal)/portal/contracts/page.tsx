import type { Metadata } from "next";
import type { ReactElement } from "react";
import Link from "next/link";
import { isZodeAdmin } from "@/features/account/admin";
import { requireAccount } from "@/features/account/session";
import { ContractTabs } from "@/features/contracts/ContractTabs";
import { loadContracts } from "@/features/portal/data";
import { ContractList, Empty, PageHeader } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";

export const metadata: Metadata = {
  title: "Contracts | ZODE",
  robots: { index: false, follow: false },
};

/** Agreements this account has entered into with ZODE, newest first. */
export default async function ContractsPage(): Promise<ReactElement> {
  const account = await requireAccount("/portal/contracts");
  const contracts = await loadContracts(account.userId);

  return (
    <div className={styles.page}>
      <PageHeader title="Contracts" subtitle="Agreements you've signed with ZODE.">
        {isZodeAdmin(account) ? <ContractTabs current="mine" /> : null}
      </PageHeader>
      {contracts === null ? (
        <Empty>Your contracts couldn&apos;t be loaded right now. Please try again shortly.</Empty>
      ) : contracts.length ? (
        <ContractList contracts={contracts} />
      ) : (
        <Empty>
          No contracts yet. <Link href="/mnda">Sign the mutual NDA</Link> while logged in with this account&apos;s email
          and it appears here.
        </Empty>
      )}
    </div>
  );
}
