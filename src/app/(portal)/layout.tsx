import type { Viewport } from "next";
import { Suspense, type ReactNode } from "react";
import { SiteShell } from "@/components/layout/SiteShell";
import { PortalChrome } from "@/features/portal/PortalChrome";
import { PortalFrame } from "@/features/portal/PortalFrame";
import { PortalNav } from "@/features/portal/PortalNav";
import { PortalSidebar } from "@/features/portal/PortalSidebar";
import { PortalTopBar } from "@/features/portal/PortalTopBar";
import styles from "@/features/portal/shell.module.css";
import { brandColor } from "@/features/styleguide/brand";

const NO_ACCESS = { admin: false, team: false };

/** The light theme's page colour, for the browser and status bar; PortalFrame swaps it for dark. */
export const viewport: Viewport = {
  themeColor: brandColor("--color-white"),
};

/**
 * The signed-in portal: a black rail of apps down the left, the sidebar for
 * the current app beside it, and the panel, all under the site's pinned header.
 * Nothing here waits on the session; the rail and sidebar stream in with the
 * account's apps and rooms, everyone's apps standing in until then.
 */
export default function PortalLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <PortalFrame>
      <SiteShell
        footer={false}
        fade={false}
        edge="flush"
        nav={
          // The fallback reads the pathname too, which a page with dynamic params only knows per request.
          <Suspense>
            <Suspense
              fallback={
                <>
                  <PortalTopBar access={NO_ACCESS} rooms={undefined} />
                  <PortalNav access={NO_ACCESS} />
                  <PortalSidebar access={NO_ACCESS} rooms={undefined} />
                </>
              }
            >
              <PortalChrome />
            </Suspense>
          </Suspense>
        }
      >
        <div className={styles.panel}>{children}</div>
      </SiteShell>
    </PortalFrame>
  );
}
