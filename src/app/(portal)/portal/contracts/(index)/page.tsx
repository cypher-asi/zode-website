import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import Link from "next/link";
import { loadMyContracts, orLogIn } from "@/features/portal/mine";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { ContractList, Empty } from "@/features/portal/sections";

export const metadata: Metadata = {
  title: "Contracts | ZODE",
  robots: { index: false, follow: false },
};

/** Agreements this account has entered into with ZODE, newest first. The layout holds the header. */
export default function ContractsPage(): ReactElement {
  return (
    <Suspense fallback={<PortalLoading header={false} nested />}>
      <Contracts />
    </Suspense>
  );
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
