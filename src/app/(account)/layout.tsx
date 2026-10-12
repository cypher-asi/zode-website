import type { ReactNode } from "react";
import { SiteShell } from "@/components/layout/SiteShell";

/** Signed-in account, contact and MNDA pages: the `(site)` shell's pinned header, without the landscape footer. */
export default function AccountLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <SiteShell footer={false}>{children}</SiteShell>;
}
