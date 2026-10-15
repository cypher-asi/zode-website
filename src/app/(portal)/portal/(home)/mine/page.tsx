import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { MyHome } from "@/features/portal/MyHome";
import { PortalLoading } from "@/features/portal/PortalLoading";

export const metadata: Metadata = {
  title: "Portal | ZODE",
};

/** Home's Mine tab for the ZODE team, whose `/portal` opens on Team. */
export default function MyHomePage(): ReactElement {
  return (
    <Suspense fallback={<PortalLoading header={false} nested />}>
      <MyHome path="/portal/mine" />
    </Suspense>
  );
}
