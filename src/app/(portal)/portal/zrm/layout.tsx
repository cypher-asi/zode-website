import type { Metadata } from "next";
import type { ReactElement } from "react";
import styles from "@/features/data-room/room.module.css";
import { requireTeam } from "@/features/zrm/access";
import { ZrmTabs } from "@/features/zrm/ZrmTabs";

export const metadata: Metadata = {
  title: "ZRM | ZODE",
  robots: { index: false, follow: false },
};

/** ZRM, the team's CRM: its name, and People, Companies and Opportunities tabs at the top right. */
export default async function ZrmLayout({ children }: LayoutProps<"/portal/zrm">): Promise<ReactElement> {
  await requireTeam("/portal/zrm");

  return (
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
      <div className={styles.body}>{children}</div>
    </div>
  );
}
