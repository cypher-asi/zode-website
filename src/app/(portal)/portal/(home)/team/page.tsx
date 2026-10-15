import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { rangeDays, TeamDashboard } from "@/features/team-dashboard/TeamDashboard";
import { requireTeam } from "@/features/zrm/access";

export const metadata: Metadata = {
  title: "Team | Portal | ZODE",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/** Home's Team tab. The layout holds the header. */
export default function TeamDashboardPage({ searchParams }: { searchParams: SearchParams }): ReactElement {
  return (
    <Suspense fallback={<PortalLoading header={false} nested />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: { searchParams: SearchParams }): Promise<ReactElement> {
  const account = await requireTeam("/portal/team");
  return <TeamDashboard account={account} rangeDays={rangeDays((await searchParams).range)} />;
}
