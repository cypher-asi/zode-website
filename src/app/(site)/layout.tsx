import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { SiteNav } from "@/components/SiteNav";
import { BottomTaskbar } from "@/components/BottomTaskbar";
import { OverlayScrollbar } from "@/components/OverlayScrollbar";
import { isAuthenticated } from "@/lib/session";
import styles from "./SiteShell.module.css";

const SITE_SCROLL_ID = "site-scroll";

export default async function SiteLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  // Defense in depth: proxy.ts already gates these routes, but re-check
  // here so content is never rendered without a valid session.
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  return (
    <div className={styles.shell}>
      <SiteNav />
      <div className={styles.body} data-shell-body="">
        <div id={SITE_SCROLL_ID} className={styles.scroll}>
          {children}
        </div>
        <OverlayScrollbar targetId={SITE_SCROLL_ID} />
      </div>
      <BottomTaskbar />
    </div>
  );
}
