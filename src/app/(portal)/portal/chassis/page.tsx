import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { listDesigns } from "@/features/chassis/designs";
import { DesignList } from "@/features/chassis/ui/DesignList";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { requireTeam } from "@/features/zrm/access";

export const metadata: Metadata = {
  title: "Chassis | Portal | ZODE",
  robots: { index: false, follow: false },
};

/** The ZODE team's pod chassis designs. */
export default function ChassisPage(): ReactElement {
  return (
    <Suspense fallback={<PortalLoading />}>
      <Designs />
    </Suspense>
  );
}

async function Designs(): Promise<ReactElement> {
  await requireTeam("/portal/chassis");
  return <DesignList designs={await listDesigns()} />;
}
