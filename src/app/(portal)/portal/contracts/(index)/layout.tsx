import { Suspense, type ReactElement } from "react";
import Link from "next/link";
import ui from "@/features/data-room/ui.module.css";
import { loadMyContracts } from "@/features/portal/mine";
import { TabbedPageHeader, type HeaderTab } from "@/features/portal/TabbedPageHeader";
import styles from "@/features/portal/portal.module.css";

const TABS: readonly HeaderTab[] = [
  { href: "/portal/contracts", label: "Mine", title: "Contracts", subtitle: "Agreements you've signed with ZODE." },
  { href: "/portal/contracts/all", label: "All agreements", title: "Contracts", subtitle: "Every agreement signed with ZODE." },
];

/**
 * The Contracts header over Mine and, for the ZODE team, All agreements. The
 * title stands at once; the team's tabs and Record button follow the session.
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
            Record contract
          </Link>
        ) : null
      }
    />
  );
}
