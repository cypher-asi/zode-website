import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactElement } from "react";
import { getDesign } from "@/features/chassis/designs";
import { designHref } from "@/features/chassis/types";
import { DesignShell } from "@/features/chassis/ui/DesignShell";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { requireTeam } from "@/features/zrm/access";

export const metadata: Metadata = {
  title: "Design | Chassis | ZODE",
  robots: { index: false, follow: false },
};

/**
 * An open design fills the panel: its bar, sheet list and inspector stay put
 * while the sheets and data pages change under them, and so do unsaved edits.
 */
export default function DesignLayout({ children, params }: LayoutProps<"/portal/chassis/[designId]">): ReactElement {
  return (
    <Suspense fallback={<PortalLoading />}>
      <Design params={params}>{children}</Design>
    </Suspense>
  );
}

async function Design({ children, params }: LayoutProps<"/portal/chassis/[designId]">): Promise<ReactElement> {
  const { designId } = await params;
  await requireTeam(designHref(designId));
  const design = await getDesign(designId);
  if (!design) notFound();
  return (
    <DesignShell
      design={{ id: design.id, name: design.name, version: design.version, archived: design.archived }}
      data={design.data}
    >
      {children}
    </DesignShell>
  );
}
