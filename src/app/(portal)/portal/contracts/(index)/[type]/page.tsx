import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadAllContracts } from "@/features/portal/data";
import { CONTRACT_TYPES, isContractKind } from "@/features/portal/nav";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { ContractList, Empty } from "@/features/portal/sections";
import { requireTeam } from "@/features/zrm/access";

export const metadata: Metadata = {
  title: "Contracts | ZODE",
  robots: { index: false, follow: false },
};

/** Every agreement of one type, newest first. The ZODE team only. The layout holds the header. */
export default function ContractTypePage({ params }: PageProps<"/portal/contracts/[type]">): ReactElement {
  return (
    <Suspense fallback={<PortalLoading header={false} nested />}>
      <ContractsOfType params={params} />
    </Suspense>
  );
}

async function ContractsOfType({ params }: Pick<PageProps<"/portal/contracts/[type]">, "params">): Promise<ReactElement> {
  const { type } = await params;
  if (!isContractKind(type)) notFound();
  await requireTeam(`/portal/contracts/${type}`);
  const contracts = await loadAllContracts();
  const shown = contracts?.filter((contract) => contract.kind === type) ?? null;
  const label = CONTRACT_TYPES.find(({ id }) => id === type)?.label.toLowerCase();

  return shown === null ? (
    <Empty>Agreements couldn&apos;t be loaded right now. Please try again shortly.</Empty>
  ) : shown.length ? (
    <ContractList contracts={shown} showSigner />
  ) : type === "compute" ? (
    <Empty>
      No compute deals have been recorded yet. <Link href="/portal/contracts/new">Record one</Link> once it&apos;s signed.
    </Empty>
  ) : (
    <Empty>No {label} have been signed yet.</Empty>
  );
}
