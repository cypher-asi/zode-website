import type { ReactNode } from "react";
import { SiteShell } from "@/components/layout/SiteShell";

/** Secondary pages: the shared site shell, closing with the landscape footer. */
export default function SiteLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <SiteShell>{children}</SiteShell>;
}
