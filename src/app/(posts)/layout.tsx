import type { ReactNode } from "react";
import { SiteShell } from "@/components/layout/SiteShell";

/** News and changelog: the `(site)` shell's pinned header, without the landscape footer. */
export default function PostsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <SiteShell footer={false}>{children}</SiteShell>;
}
