import type { Metadata } from "next";
import { Suspense, type ReactElement, type ReactNode } from "react";
import styles from "@/features/data-room/room.module.css";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { requireTeam } from "@/features/zrm/access";
import { loadZrmData } from "@/features/zrm/queries";
import { Workspace } from "@/features/zrm/Workspace";
import { ZrmProvider } from "@/features/zrm/ZrmProvider";
import { ZrmTabs } from "@/features/zrm/ZrmTabs";

export const metadata: Metadata = {
  title: "ZRM | ZODE",
  robots: { index: false, follow: false },
};

/**
 * ZRM, the team's CRM: its name, People, Companies and Opportunities tabs at
 * the top right, and the open tab's list. Every list loads here, once, from
 * the server's cache, so switching tabs or records never waits on them;
 * mutations update the tags of the lists they touch. The data is only
 * rendered once `requireTeam` passes; until then the bar shows ZRM's name.
 */
export default function ZrmLayout({ children }: LayoutProps<"/portal/zrm">): ReactElement {
  return (
    <Suspense
      fallback={
        <div className={styles.frame}>
          <header className={styles.bar}>
            <div className={styles.titleGroup}>
              <div className={styles.titleRow}>
                <h1 className={styles.title}>ZRM</h1>
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
      <Zrm>{children}</Zrm>
    </Suspense>
  );
}

async function Zrm({ children }: { children: ReactNode }): Promise<ReactElement> {
  const [, data] = await Promise.all([requireTeam("/portal/zrm"), loadZrmData("zrm")]);

  return (
    <ZrmProvider app="zrm" data={data}>
      <div className={styles.frame}>
        <header className={styles.bar}>
          <div className={styles.titleGroup}>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>ZRM</h1>
              <span className={styles.role}>Team</span>
            </div>
          </div>
          <div className={styles.headerActions}>
            <ZrmTabs />
          </div>
        </header>
        <div className={styles.body}>
          <Workspace>{children}</Workspace>
        </div>
      </div>
    </ZrmProvider>
  );
}
