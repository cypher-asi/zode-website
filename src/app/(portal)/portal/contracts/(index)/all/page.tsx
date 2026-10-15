import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { loadAllContracts } from "@/features/portal/data";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { ContractList, Empty } from "@/features/portal/sections";
import { requireTeam } from "@/features/zrm/access";

export const metadata: Metadata = {
  title: "All agreements | Contracts | ZODE",
  robots: { index: false, follow: false },
};

/** Every MNDA anyone has signed, including those signed while logged out, and every compute contract. The ZODE team only. */
export default function AllContractsPage(): ReactElement {
  return (
    <Suspense fallback={<PortalLoading header={false} nested />}>
      <AllContracts />
    </Suspense>
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
