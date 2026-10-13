import type { Metadata } from "next";
import { Suspense, type ReactElement, type ReactNode } from "react";
import styles from "@/features/data-room/room.module.css";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { requireTeam } from "@/features/zrm/access";
import { loadZrmData } from "@/features/zrm/queries";
import { Workspace } from "@/features/zrm/Workspace";
import { ZrmNewButton } from "@/features/zrm/ZrmNewButton";
import { ZrmProvider } from "@/features/zrm/ZrmProvider";

export const metadata: Metadata = {
  title: "Capacity | ZODE",
  robots: { index: false, follow: false },
};

/**
 * Capacity, the team's data center sites: ZRM's list and record panes over
 * sites, whose providers, customers, brokers and firms link into ZRM. Every
 * list loads here, once, from the server's cache, ZRM's people and companies
 * too for those pickers and links; mutations update the tags of the lists
 * they touch. The data is only rendered once `requireTeam` passes; until then
 * the bar shows Capacity's name.
 */
export default function CapacityLayout({ children }: LayoutProps<"/portal/capacity">): ReactElement {
  return (
    <Suspense
      fallback={
        <div className={styles.frame}>
          <header className={styles.bar}>
            <div className={styles.titleGroup}>
              <div className={styles.titleRow}>
                <h1 className={styles.title}>Capacity</h1>
                <span className={styles.role}>Team</span>
              </div>
            </div>
          </header>
          <div className={styles.body}>
            <PortalLoading header={false} />
          </div>
        </div>
      }
    >
      <Capacity>{children}</Capacity>
    </Suspense>
  );
}

async function Capacity({ children }: { children: ReactNode }): Promise<ReactElement> {
  const [, data] = await Promise.all([requireTeam("/portal/capacity"), loadZrmData("capacity")]);

  return (
    <ZrmProvider app="capacity" data={data}>
      <div className={styles.frame}>
        <header className={styles.bar}>
          <div className={styles.titleGroup}>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>Capacity</h1>
              <span className={styles.role}>Team</span>
            </div>
          </div>
          <div className={styles.headerActions}>
            <ZrmNewButton />
          </div>
        </header>
        <div className={styles.body}>
          <Workspace>{children}</Workspace>
        </div>
      </div>
    </ZrmProvider>
  );
}
