import { Suspense, type ReactElement } from "react";
import Link from "next/link";
import type { ContractKind } from "@/features/contracts/contracts";
import ui from "@/features/data-room/ui.module.css";
import { loadMyContracts } from "@/features/portal/mine";
import { CONTRACT_TYPES } from "@/features/portal/nav";
import { TabbedPageHeader, type HeaderTab } from "@/features/portal/TabbedPageHeader";
import styles from "@/features/portal/portal.module.css";

const SUBTITLES: Record<ContractKind, string> = {
  compute: "Executed MSAs and order forms for ZODE compute.",
  mnda: "Mutual NDAs signed in the portal, with or without an account.",
};

const TABS: readonly HeaderTab[] = [
  { href: "/portal/contracts", label: "Mine", title: "Contracts", subtitle: "Agreements you've signed with ZODE." },
  { href: "/portal/contracts/all", label: "All", title: "Contracts", subtitle: "Every agreement signed with ZODE, by type." },
  ...CONTRACT_TYPES.map((type) => ({
    href: `/portal/contracts/${type.id}`,
    label: type.label,
    title: type.label,
    subtitle: SUBTITLES[type.id],
  })),
];

/**
 * The Contracts header over Mine and, for the ZODE team, All and each type.
 * The title stands at once; the team's tabs and Record button follow the session.
 */
export default function ContractsLayout({ children }: LayoutProps<"/portal/contracts">): ReactElement {
  return (
    <div className={styles.page}>
      <Suspense fallback={<TabbedPageHeader tabs={TABS} label="Contracts" showTabs={false} />}>
        <ContractsHeader />
      </Suspense>
      {children}
    </div>
  );
}

async function ContractsHeader(): Promise<ReactElement> {
  const team = (await loadMyContracts())?.team ?? false;
  return (
    <TabbedPageHeader
      tabs={TABS}
      label="Contracts"
      showTabs={team}
      actions={
        team ? (
          <Link href="/portal/contracts/new" className={ui.primary}>
            Record deal
          </Link>
        ) : null
      }
    />
  );
}
