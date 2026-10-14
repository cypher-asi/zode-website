import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { InboundApp } from "@/features/factory/inbound/InboundApp";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { requireTeam } from "@/features/zrm/access";

export const metadata: Metadata = {
  title: "Inbound & receiving | Factory | ZODE",
  robots: { index: false, follow: false },
};

/** The factory's receiving dock, simulated, for the ZODE team. */
export default function InboundPage(): ReactElement {
  return (
    <Suspense fallback={<PortalLoading />}>
      <Inbound />
    </Suspense>
  );
}

async function Inbound(): Promise<ReactElement> {
  await requireTeam("/portal/factory/inbound");
  return <InboundApp />;
}
