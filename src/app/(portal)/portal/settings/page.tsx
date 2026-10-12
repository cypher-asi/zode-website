import type { Metadata } from "next";
import type { ReactElement } from "react";
import { LogoutButton } from "@/features/account/LogoutButton";
import { avatarUrl, loadProfile } from "@/features/account/profile";
import { requireAccount } from "@/features/account/session";
import ui from "@/features/data-room/ui.module.css";
import { SettingsSubscription } from "@/features/mailing-list/SettingsSubscription";
import { PageHeader } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";
import { AvatarField } from "@/features/settings/AvatarField";
import { NameForm } from "@/features/settings/NameForm";
import settings from "@/features/settings/settings.module.css";

export const metadata: Metadata = {
  title: "Settings | ZODE",
};

/** Your profile as the portal shows it, and the ZOS account behind it. */
export default async function SettingsPage(): Promise<ReactElement> {
  const account = await requireAccount("/portal/settings");
  const profile = await loadProfile(account.userId);
  const photo = profile?.avatarPathname ? avatarUrl(account.userId, profile.avatarPathname) : null;

  return (
    <div className={styles.page}>
      <PageHeader title="Settings" subtitle="Your profile and account.">
        <LogoutButton className={ui.button} />
      </PageHeader>

      <section className={styles.section} aria-labelledby="settings-profile">
        <div className={styles.sectionHead}>
          <h2 id="settings-profile" className={styles.sectionTitle}>
            Profile
          </h2>
        </div>
        <div className={settings.card}>
          <AvatarField userId={account.userId} name={account.displayName} src={photo} />
          <NameForm name={account.displayName} />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="settings-account">
        <div className={styles.sectionHead}>
          <h2 id="settings-account" className={styles.sectionTitle}>
            Account
          </h2>
        </div>
        <div className={settings.card}>
          <dl className={settings.details}>
            <dt>Email</dt>
            <dd>{account.email}</dd>
            <dt>ZID</dt>
            <dd>{account.primaryZid || "—"}</dd>
          </dl>
          <p className={settings.hint}>Your email and ZID belong to your ZOS account and can&apos;t be changed here.</p>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="settings-mailing-list">
        <div className={styles.sectionHead}>
          <h2 id="settings-mailing-list" className={styles.sectionTitle}>
            Mailing list
          </h2>
        </div>
        <div className={settings.card}>
          <SettingsSubscription account={account} />
        </div>
      </section>
    </div>
  );
}
