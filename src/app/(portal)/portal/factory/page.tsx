import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { FactoryApp } from "@/features/factory/FactoryApp";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { requireTeam } from "@/features/zrm/access";

export const metadata: Metadata = {
  title: "Factory | Portal | ZODE",
  robots: { index: false, follow: false },
};

/** The compute pod factory floor, simulated, for the ZODE team. */
export default function FactoryPage(): ReactElement {
  return (
    <Suspense fallback={<PortalLoading />}>
      <Factory />
    </Suspense>
  );
}

async function Factory(): Promise<ReactElement> {
  await requireTeam("/portal/factory");
  return <FactoryApp />;
}
