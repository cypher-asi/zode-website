import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import Link from "next/link";
import { ContractTabs } from "@/features/contracts/ContractTabs";
import { loadMyContracts, orLogIn } from "@/features/portal/mine";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { ContractList, Empty, PageHeader } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";

export const metadata: Metadata = {
  title: "Contracts | ZODE",
  robots: { index: false, follow: false },
};

/** Agreements this account has entered into with ZODE, newest first. */
export default function ContractsPage(): ReactElement {
  return (
    <div className={styles.page}>
      <PageHeader title="Contracts" subtitle="Agreements you've signed with ZODE.">
        <Suspense fallback={null}>
          <TeamTabs />
        </Suspense>
      </PageHeader>
      <Suspense fallback={<PortalLoading header={false} nested />}>
        <Contracts />
      </Suspense>
    </div>
  );
}

/** The tabs over to everyone's contracts, for the ZODE team. */
async function TeamTabs(): Promise<ReactElement | null> {
  const mine = await loadMyContracts();
  return mine?.team ? <ContractTabs current="mine" /> : null;
}

async function Contracts(): Promise<ReactElement> {
  const { contracts } = orLogIn(await loadMyContracts(), "/portal/contracts");
  return contracts === null ? (
    <Empty>Your contracts couldn&apos;t be loaded right now. Please try again shortly.</Empty>
  ) : contracts.length ? (
    <ContractList contracts={contracts} />
  ) : (
    <Empty>
      No contracts yet. <Link href="/mnda">Sign the mutual NDA</Link> while logged in with this account&apos;s email
      and it appears here.
    </Empty>
  );
}
