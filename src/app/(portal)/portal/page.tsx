import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { MyHome } from "@/features/portal/MyHome";
import { PortalLoading } from "@/features/portal/PortalLoading";

export const metadata: Metadata = {
  title: "Portal | ZODE",
};

/** Signed-in home: who you are, your figures at a glance, and the latest rooms and orders. The ZODE team land on Team. */
export default function HomePage(): ReactElement {
  return (
    <Suspense fallback={<PortalLoading />}>
      <MyHome path="/portal" />
    </Suspense>
  );
}
