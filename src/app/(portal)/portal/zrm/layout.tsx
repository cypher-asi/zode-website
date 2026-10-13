import type { Metadata } from "next";
import type { ReactElement } from "react";
import styles from "@/features/data-room/room.module.css";
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
 * the top right, and the open tab's list. Every list loads here, once, so
 * switching tabs or records never waits on them; mutations revalidate this
 * layout to refresh them. The data is only rendered once `requireTeam` passes.
 */
export default async function ZrmLayout({ children }: LayoutProps<"/portal/zrm">): Promise<ReactElement> {
  const [, data] = await Promise.all([requireTeam("/portal/zrm"), loadZrmData()]);

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
